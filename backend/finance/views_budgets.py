from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import Budget, Transaction, Category
from .serializers import BudgetSerializer

class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]
    serializer_class = BudgetSerializer

    def get_queryset(self):
        return Budget.objects.filter(owner=self.request.user).order_by("-created_at")

    @extend_schema(
        tags=["budgets"],
        parameters=[
            OpenApiParameter(
                name="month",
                type=str,
                location=OpenApiParameter.QUERY,
                required=True,
                description="YYYY-MM",
            ),
        ],
        responses={200: dict},
    )

    @action(detail=False, methods=["get"], url_path="status")
    def status(self, request):
        month = request.query_params.get("month")
        if not month or len(month) != 7 or month[4] != "-":
            return Response({"detail": "month must be YYYY-MM"}, status=400)

        y = int(month[:4])
        m = int(month[5:7])
        start = timezone.datetime(y, m, 1, tzinfo=timezone.get_current_timezone())
        if m == 12:
            end = timezone.datetime(y + 1, 1, 1, tzinfo=timezone.get_current_timezone())
        else:
            end = timezone.datetime(y, m + 1, 1, tzinfo=timezone.get_current_timezone())

        user = request.user
        base_currency = getattr(getattr(user, "profile", None), "base_currency", "THB")

        tx_qs = Transaction.objects.filter(
            owner=user,
            is_deleted=False,
            type="expense",
            occurred_at__gte=start,
            occurred_at__lt=end,
        )

        budgets = Budget.objects.filter(owner=user, month=month).select_related("category")

        items = []
        for b in budgets:
            if b.scope == "total":
                spent = tx_qs.aggregate(s=Sum("base_amount"))["s"] or Decimal("0")
                title = "Total Budget"
                category_id = None
            else:
                spent = tx_qs.filter(category_id=b.category_id).aggregate(s=Sum("base_amount"))["s"] or Decimal("0")
                title = f"Category: {b.category.name if b.category else 'Uncategorized'}"
                category_id = b.category_id

            limit = Decimal(b.limit_base_amount)
            remaining = limit - spent
            pct = (spent / limit * 100) if limit > 0 else Decimal("0")

            items.append({
                "budget_id": b.id,
                "title": title,
                "scope": b.scope,
                "category_id": category_id,
                "limit": f"{limit:.2f}",
                "spent": f"{spent:.2f}",
                "remaining": f"{remaining:.2f}",
                "percent_used": f"{pct:.2f}",
                "alert_80_sent": b.alert_80_sent,
                "alert_100_sent": b.alert_100_sent,
            })

        return Response({
            "month": month,
            "base_currency": base_currency,
            "items": items,
        })

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance):
        instance.delete()
