from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.money import quantize_money, to_decimal
from app.models.finance_coa import (
    Account,
    AccountType,
    FiscalYear,
    JournalEntry,
    JournalEntryStatus,
    JournalLine,
    NormalBalance,
    OpeningBalance,
)
from app.services.accounting_service import AccountingService
from app.services.inventory_coordinator import InventoryCoordinator

TENANT_ID = 1


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    tables = [Account.__table__, FiscalYear.__table__, JournalEntry.__table__, OpeningBalance.__table__, JournalLine.__table__]
    for table in tables:
        table.create(bind=engine, checkfirst=True)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        for table in reversed(tables):
            table.drop(bind=engine, checkfirst=True)


def _make_account(db: Session, code: str, name: str, account_type: AccountType, normal_balance: NormalBalance) -> Account:
    account = Account(
        tenant_id=TENANT_ID,
        account_code=code,
        name=name,
        account_type=account_type,
        normal_balance=normal_balance,
        is_active=True,
        allow_manual_entries=True,
        is_system=False,
    )
    db.add(account)
    db.flush()
    return account


def test_to_decimal_and_quantize_money_helpers():
    assert to_decimal(None) == Decimal("0")
    assert to_decimal(Decimal("5.5")) == Decimal("5.5")
    assert to_decimal(5) == Decimal("5")
    assert to_decimal(0.1) == Decimal("0.1")

    # ROUND_HALF_UP, not Python's banker's rounding (round(0.125, 2) == 0.12)
    assert quantize_money(Decimal("0.125")) == Decimal("0.13")
    assert quantize_money(0.125) == Decimal("0.13")
    assert quantize_money(None) == Decimal("0.00")


def test_calculate_average_cost_with_decimal_inputs(db_session: Session):
    coordinator = InventoryCoordinator(db_session)

    result = coordinator._calculate_average_cost(
        current_quantity=Decimal("100"),
        current_average_cost=Decimal("10.00"),
        incoming_quantity=Decimal("50"),
        incoming_unit_cost=Decimal("13.00"),
    )
    # (100*10 + 50*13) / 150 = 1650/150 = 11.0000
    assert result == Decimal("11.0000")

    # mixed Decimal/float/int inputs, as arrive from schema-validated payloads
    mixed = coordinator._calculate_average_cost(
        current_quantity=0,
        current_average_cost=0.0,
        incoming_quantity=Decimal("25.5"),
        incoming_unit_cost=Decimal("4.125"),
    )
    assert mixed == Decimal("4.1250")


def test_post_journal_entry_with_decimal_amounts_and_reports(db_session: Session):
    cash = _make_account(db_session, "1111", "Cash", AccountType.ASSET, NormalBalance.DEBIT)
    _make_account(db_session, "4110", "Sales Revenue", AccountType.REVENUE, NormalBalance.CREDIT)
    _make_account(db_session, "5000", "Cost of Goods Sold", AccountType.COST_OF_SALES, NormalBalance.DEBIT)
    _make_account(db_session, "1134", "Finished Goods Inventory", AccountType.ASSET, NormalBalance.DEBIT)

    svc = AccountingService(db_session, tenant_id=TENANT_ID)

    sale_amount = Decimal("1000.555")
    cogs_amount = Decimal("600.125")

    entry = svc.create_and_post_journal(
        entry_date=date(2026, 1, 15),
        lines=[
            {"account_code": "1111", "debit": sale_amount},
            {"account_code": "4110", "credit": sale_amount},
            {"account_code": "5000", "debit": cogs_amount},
            {"account_code": "1134", "credit": cogs_amount},
        ],
        description="Test sale",
        reference_type="sale",
        reference_id=1,
        source_module="sales",
        created_by_user_id=1,
    )
    assert entry.status == JournalEntryStatus.POSTED

    sale_q = quantize_money(sale_amount)  # Decimal("1000.56"), ROUND_HALF_UP
    cogs_q = quantize_money(cogs_amount)  # Decimal("600.13"), ROUND_HALF_UP

    ledger = svc.get_ledger(cash.id)
    assert ledger["opening_balance"] == Decimal("0.00")
    assert ledger["closing_balance"] == sale_q
    assert len(ledger["entries"]) == 1
    assert ledger["entries"][0]["debit"] == sale_q
    assert ledger["entries"][0]["balance"] == sale_q

    trial_balance = svc.get_trial_balance()
    assert trial_balance["is_balanced"] is True
    assert trial_balance["total_debit"] == trial_balance["total_credit"]

    pnl = svc.get_profit_and_loss()
    assert pnl["total_revenue"] == sale_q
    assert pnl["total_cost_of_sales"] == cogs_q
    assert pnl["gross_profit"] == sale_q - cogs_q
    assert pnl["net_profit"] == sale_q - cogs_q

    balance_sheet = svc.get_balance_sheet()
    assert balance_sheet["total_assets"] == sale_q - cogs_q
    assert isinstance(balance_sheet["is_balanced"], bool)

    cash_flow = svc.get_cash_flow()
    assert cash_flow["total_operating"] == sale_q
    assert cash_flow["total_investing"] == Decimal("0.00")
    assert cash_flow["total_financing"] == Decimal("0.00")
    assert cash_flow["net_cash_flow"] == sale_q


def test_validate_balance_rejects_unbalanced_decimal_lines(db_session: Session):
    _make_account(db_session, "1111", "Cash", AccountType.ASSET, NormalBalance.DEBIT)
    _make_account(db_session, "4110", "Sales Revenue", AccountType.REVENUE, NormalBalance.CREDIT)
    svc = AccountingService(db_session, tenant_id=TENANT_ID)

    entry = svc.create_journal_entry(entry_date=date(2026, 1, 15))
    svc.add_journal_line(entry, "1111", debit=Decimal("100.00"), credit=Decimal("0"))
    svc.add_journal_line(entry, "4110", debit=Decimal("0"), credit=Decimal("99.00"))
    db_session.flush()

    with pytest.raises(HTTPException):
        svc._validate_balance(entry.lines)
