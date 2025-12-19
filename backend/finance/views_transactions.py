from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FxRate, Category, Transaction
from .serializers import (
    FxRateSerializer,
    CategorySerializer,
    TransactionSerializer,
    TransferCreateSerializer,
)
from .pagination import StandardResultsSetPagination


class FxRateViewSet(viewsets.ModelViewSet):
    """
    ช่วงแรกให้สร้างเองก่อนใน Swagger
    (อนาคตค่อยทำ job ดึงอัตโนมัติ)
    """
    queryset = FxRate.objects.all().order_by("-date")
    serializer_class = FxRateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["date", "base", "quote"]


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["type", "parent"]

    def get_queryset(self):
        return Category.objects.filter(owner=self.request.user).order_by("type", "name")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    # ✅ เปิดทั้ง filter + pagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["type", "wallet", "category"]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        """
        รองรับ query:
            - from=YYYY-MM-DD
            - to=YYYY-MM-DD
            - type=...
            - wallet=<id>
            - category=<id>

        หมายเหตุ: type/wallet/category มีอยู่แล้วผ่าน DjangoFilterBackend
        แต่ from/to ต้อง filter เอง (date range)
        """
        qs = Transaction.objects.filter(owner=self.request.user, is_deleted=False).order_by("-occurred_at")

        f_s = self.request.query_params.get("from")
        t_s = self.request.query_params.get("to")

        if f_s and t_s:
            f = parse_date(f_s)
            t = parse_date(t_s)
            if f and t:
                qs = qs.filter(occurred_at__date__gte=f, occurred_at__date__lte=t)

        return qs

    def perform_destroy(self, instance):
        # soft delete
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])

    @action(detail=False, methods=["post"], url_path="transfer")
    def transfer(self, request):
        ser = TransferCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        result = ser.save()

        return Response(
            {
                "link_id": result["link_id"],
                "out_tx": TransactionSerializer(result["out_tx"], context={"request": request}).data,
                "in_tx": TransactionSerializer(result["in_tx"], context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )
