from datetime import datetime
from decimal import Decimal
from django.utils.dateparse import parse_date
from django.db.models import Sum, Q
from django.db.models.functions import TruncDay, TruncWeek, TruncMonth
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import Wallet, Transaction, Currency
from .serializers import WalletSerializer, _get_fx_rate


def _parse_range(request):
    """
    รับ query params:
      from=YYYY-MM-DD
      to=YYYY-MM-DD
    """
    from_s = request.query_params.get("from")
    to_s = request.query_params.get("to")

    if not from_s or not to_s:
        return (
            None,
            None,
            Response(
                {"detail": "Query params required: from=YYYY-MM-DD&to=YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST,
            ),
        )

    f = parse_date(from_s)
    t = parse_date(to_s)
    if not f or not t:
        return (
            None,
            None,
            Response({"detail": "Invalid date format. Use YYYY-MM-DD"}, status=400),
        )

    if f > t:
        return None, None, Response({"detail": "`from` must be <= `to`"}, status=400)

    return f, t, None


class ReportSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["reports"],
        parameters=[
            OpenApiParameter("from", str, required=True, description="YYYY-MM-DD"),
            OpenApiParameter("to", str, required=True, description="YYYY-MM-DD"),
        ],
        responses={200: dict},
    )
    def get(self, request):
        f, t, err = _parse_range(request)
        if err:
            return err

        qs = Transaction.objects.filter(
            owner=request.user,
            is_deleted=False,
            occurred_at__date__gte=f,
            occurred_at__date__lte=t,
        )

        income = qs.filter(type="income").aggregate(s=Sum("base_amount"))["s"] or 0
        expense = qs.filter(type="expense").aggregate(s=Sum("base_amount"))["s"] or 0
        net = income - expense

        return Response(
            {
                "from": str(f),
                "to": str(t),
                "base_currency": request.user.profile.base_currency,
                "income": str(income),
                "expense": str(expense),
                "net": str(net),
            }
        )


class ReportByCategoryView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["reports"],
        parameters=[
            OpenApiParameter("from", str, required=True, description="YYYY-MM-DD"),
            OpenApiParameter("to", str, required=True, description="YYYY-MM-DD"),
            OpenApiParameter(
                "type",
                str,
                required=False,
                description="expense or income (default: expense)",
            ),
        ],
        responses={200: list},
    )
    def get(self, request):
        f, t, err = _parse_range(request)
        if err:
            return err

        tx_type = request.query_params.get("type", "expense")
        if tx_type not in ("expense", "income"):
            return Response({"detail": "type must be expense or income"}, status=400)

        qs = (
            Transaction.objects.filter(
                owner=request.user,
                is_deleted=False,
                type=tx_type,
                occurred_at__date__gte=f,
                occurred_at__date__lte=t,
            )
            .values("category__id", "category__name")
            .annotate(total=Sum("base_amount"))
            .order_by("-total")
        )

        # category อาจเป็น null
        data = []
        for row in qs:
            data.append(
                {
                    "category_id": row["category__id"],
                    "category_name": row["category__name"] or "Uncategorized",
                    "total": str(row["total"] or 0),
                }
            )

        return Response(
            {
                "from": str(f),
                "to": str(t),
                "type": tx_type,
                "base_currency": request.user.profile.base_currency,
                "items": data,
            }
        )


class ReportTrendView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["reports"],
        parameters=[
            OpenApiParameter("from", str, required=True, description="YYYY-MM-DD"),
            OpenApiParameter("to", str, required=True, description="YYYY-MM-DD"),
            OpenApiParameter(
                "interval",
                str,
                required=False,
                description="daily|weekly|monthly (default: daily)",
            ),
        ],
        responses={200: dict},
    )
    def get(self, request):
        f, t, err = _parse_range(request)
        if err:
            return err

        interval = request.query_params.get("interval", "daily")
        if interval not in ("daily", "weekly", "monthly"):
            return Response(
                {"detail": "interval must be daily|weekly|monthly"}, status=400
            )

        trunc_map = {
            "daily": TruncDay("occurred_at"),
            "weekly": TruncWeek("occurred_at"),
            "monthly": TruncMonth("occurred_at"),
        }

        qs = Transaction.objects.filter(
            owner=request.user,
            is_deleted=False,
            occurred_at__date__gte=f,
            occurred_at__date__lte=t,
        )

        rows = (
            qs.annotate(bucket=trunc_map[interval])
            .values("bucket")
            .annotate(
                income=Sum("base_amount", filter=Q(type="income")),
                expense=Sum("base_amount", filter=Q(type="expense")),
            )
            .order_by("bucket")
        )

        items = []
        for row in rows:
            bucket = row["bucket"]
            # bucket อาจเป็น datetime
            bucket_date = (
                bucket.date().isoformat() if hasattr(bucket, "date") else str(bucket)
            )
            items.append(
                {
                    "bucket": bucket_date,
                    "income": str(row["income"] or 0),
                    "expense": str(row["expense"] or 0),
                }
            )

        return Response(
            {
                "from": str(f),
                "to": str(t),
                "interval": interval,
                "base_currency": request.user.profile.base_currency,
                "items": items,
            }
        )


class ReportTopMerchantsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["reports"],
        parameters=[
            OpenApiParameter("from", str, required=True, description="YYYY-MM-DD"),
            OpenApiParameter("to", str, required=True, description="YYYY-MM-DD"),
            OpenApiParameter(
                "type",
                str,
                required=False,
                description="expense or income (default: expense)",
            ),
            OpenApiParameter("limit", int, required=False, description="default 10"),
        ],
        responses={200: dict},
    )
    def get(self, request):
        f, t, err = _parse_range(request)
        if err:
            return err

        tx_type = request.query_params.get("type", "expense")
        if tx_type not in ("expense", "income"):
            return Response({"detail": "type must be expense or income"}, status=400)

        limit = int(request.query_params.get("limit", 10))

        qs = (
            Transaction.objects.filter(
                owner=request.user,
                is_deleted=False,
                type=tx_type,
                occurred_at__date__gte=f,
                occurred_at__date__lte=t,
            )
            .exclude(merchant="")
            .values("merchant")
            .annotate(total=Sum("base_amount"))
            .order_by("-total")[:limit]
        )

        items = [
            {"merchant": row["merchant"], "total": str(row["total"] or 0)} for row in qs
        ]

        return Response(
            {
                "from": str(f),
                "to": str(t),
                "type": tx_type,
                "limit": limit,
                "base_currency": request.user.profile.base_currency,
                "items": items,
            }
        )


class ReportWalletBalancesView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["reports"],
        parameters=[
            OpenApiParameter(
                "as_of", str, required=False, description="YYYY-MM-DD (optional)"
            ),
        ],
        responses={200: dict},
    )
    def get(self, request):
        as_of_s = request.query_params.get("as_of")
        as_of = parse_date(as_of_s) if as_of_s else None
        if as_of_s and not as_of:
            return Response(
                {"detail": "Invalid as_of format. Use YYYY-MM-DD"}, status=400
            )

        user = request.user
        base_currency = Currency.objects.get(code=user.profile.base_currency)

        wallets = (
            Wallet.objects.filter(owner=user, is_active=True)
            .select_related("currency")
            .order_by("name")
        )

        items = []
        for w in wallets:
            qs = Transaction.objects.filter(
                owner=user,
                wallet=w,
                is_deleted=False,
            )

            if as_of:
                qs = qs.filter(occurred_at__date__lte=as_of)

            # รวมยอดในสกุลเงิน wallet (amount) — ถูกต้องเพราะ currency ตาม wallet
            income = qs.filter(type="income").aggregate(s=Sum("amount"))[
                "s"
            ] or Decimal("0")
            expense = qs.filter(type="expense").aggregate(s=Sum("amount"))[
                "s"
            ] or Decimal("0")
            tin = qs.filter(type="transfer_in").aggregate(s=Sum("amount"))[
                "s"
            ] or Decimal("0")
            tout = qs.filter(type="transfer_out").aggregate(s=Sum("amount"))[
                "s"
            ] or Decimal("0")

            balance = (w.opening_balance + income + tin - expense - tout).quantize(
                Decimal("0.01")
            )

            # แปลงยอดคงเหลือเป็น base currency (เพื่อทำ overview รวม)
            if w.currency_id == base_currency.id:
                base_balance = balance
            else:
                # ใช้เรทของ "วัน as_of" หรือ "วันนี้" ถ้าไม่ระบุ
                rate_date = (
                    as_of
                    if as_of
                    else (
                        qs.order_by("-occurred_at").first().occurred_at.date()
                        if qs.exists()
                        else None
                    )
                )
                # ถ้าไม่มี tx เลยและไม่ระบุ as_of -> ใช้วันนี้
                if not rate_date:
                    from django.utils import timezone

                    rate_date = timezone.now().date()

                fx = _get_fx_rate(rate_date, w.currency, base_currency)
                base_balance = (balance * fx).quantize(Decimal("0.01"))

            items.append(
                {
                    "wallet": WalletSerializer(w, context={"request": request}).data,
                    "currency": w.currency.code,
                    "opening_balance": str(w.opening_balance),
                    "income": str(income),
                    "expense": str(expense),
                    "transfer_in": str(tin),
                    "transfer_out": str(tout),
                    "balance": str(balance),  # ตามสกุล wallet
                    "base_currency": base_currency.code,
                    "base_balance": str(base_balance),  # แปลงเป็น base ของ user
                }
            )

        # รวม base_balance ทุก wallet
        total_base = (
            sum(Decimal(x["base_balance"]) for x in items) if items else Decimal("0")
        )

        return Response(
            {
                "as_of": as_of.isoformat() if as_of else None,
                "base_currency": base_currency.code,
                "total_base_balance": str(total_base.quantize(Decimal("0.01"))),
                "items": items,
            }
        )
