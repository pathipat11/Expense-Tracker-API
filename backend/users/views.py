from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .serializers import RegisterSerializer, MeSerializer

from drf_spectacular.utils import extend_schema
from rest_framework import serializers


User = get_user_model()

def set_refresh_cookie(response: Response, refresh_token: str):
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
        max_age=14 * 24 * 60 * 60,
    )

def clear_refresh_cookie(response: Response):
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path="/",
    )

class RegisterView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=RegisterSerializer,
        responses={201: None},
        tags=["auth"]
    )
    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(
            {"id": user.id, "username": user.username, "email": user.email},
            status=status.HTTP_201_CREATED
        )
        
class LoginInputSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    username = serializers.CharField(required=False)
    password = serializers.CharField()

class LoginView(APIView):
    permission_classes = [AllowAny]
    
    @extend_schema(
        request=LoginInputSerializer,
        responses={200: None},
        tags=["auth"]
    )

    def post(self, request):
        username = request.data.get("username")
        email = request.data.get("email")
        password = request.data.get("password")

        # รองรับ login ด้วย username หรือ email
        user = None
        if email:
            try:
                user = User.objects.get(email=email)
                username = user.username
            except User.DoesNotExist:
                pass

        user = authenticate(request, username=username, password=password)
        if not user:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)

        res = Response(
            {"access": access, "user": MeSerializer(user).data},
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(res, str(refresh))
        return res

class RefreshView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(tags=["auth"])
    def post(self, request):
        refresh_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not refresh_token:
            return Response({"detail": "Missing refresh cookie"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            old_refresh = RefreshToken(refresh_token)

            # ✅ ดึง user_id จาก payload แล้ว query user เอง
            user_id = old_refresh.get("user_id")
            if not user_id:
                return Response({"detail": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

            user = User.objects.filter(id=user_id, is_active=True).first()
            if not user:
                return Response({"detail": "User not found"}, status=status.HTTP_401_UNAUTHORIZED)

            # ✅ rotate refresh (ถ้าเปิด)
            if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS", False):
                new_refresh = RefreshToken.for_user(user)

                # blacklist token เก่าถ้าเปิดไว้
                if settings.SIMPLE_JWT.get("BLACKLIST_AFTER_ROTATION", False):
                    try:
                        old_refresh.blacklist()
                    except Exception:
                        pass
            else:
                new_refresh = old_refresh

            access = str(new_refresh.access_token)

            res = Response({"access": access}, status=status.HTTP_200_OK)
            set_refresh_cookie(res, str(new_refresh))
            return res

        except TokenError:
            return Response({"detail": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(tags=["auth"])
    def post(self, request):
        refresh_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        res = Response({"detail": "Logged out"}, status=status.HTTP_200_OK)

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        clear_refresh_cookie(res)
        return res

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        ser = MeSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
