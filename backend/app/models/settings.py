import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, UniqueConstraint, ForeignKey

from app.db.base import Base
from app.db.enums import db_enum


class ProductCatalog(Base):
    __tablename__ = "product_catalog"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    sku = Column(String, unique=True, index=True, nullable=True)
    description = Column(Text, nullable=True)
    base_price = Column(Float, default=0.0, nullable=False)
    wholesale_price = Column(Float, default=0.0, nullable=False)
    is_active = Column(Boolean, default=True)


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
    description = Column(Text, nullable=True)


class SystemSettings(Base):
    """Singleton platform settings used for public branding and integrations."""

    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    system_name = Column(String(120), nullable=False, default="Farmexa")
    system_logo_url = Column(String(500), nullable=True)
    system_favicon_url = Column(String(500), nullable=True)
    primary_color = Column(String(40), nullable=False, default="#d6a62e")
    secondary_color = Column(String(40), nullable=False, default="#202020")
    platform_domain = Column(String(255), nullable=False, default="myfarm.arosoftlabs.com")
    tenant_domain_suffix = Column(String(255), nullable=False, default="arosoftlabs.com")
    sender_email = Column(String(255), nullable=False, default="farmexa@arosoftlabs.com")
    sender_name = Column(String(120), nullable=False, default="Farmexa")
    support_email = Column(String(255), nullable=False, default="farmexa@arosoftlabs.com")
    company_name = Column(String(120), nullable=False, default="AROSOFT")
    footer_text = Column(String(255), nullable=False, default="Powered by AROSOFT")
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=False, default=587)
    smtp_username = Column(String(255), nullable=True)
    smtp_password = Column(Text, nullable=True)
    smtp_use_tls = Column(Boolean, nullable=False, default=True)
    cloudflare_api_token = Column(Text, nullable=True)
    cloudflare_zone_id = Column(String(255), nullable=True)
    tenant_domain_target_ip = Column(String(100), nullable=True)
    enable_cloudflare_dns_automation = Column(Boolean, nullable=False, default=True)
    enable_automatic_ssl_provisioning = Column(Boolean, nullable=False, default=False)
    pesapal_consumer_key = Column(String(255), nullable=True)
    pesapal_consumer_secret = Column(Text, nullable=True)
    pesapal_environment = Column(String(20), nullable=False, default="production")
    pesapal_ipn_id = Column(String(120), nullable=True)
    pesapal_ipn_url = Column(String(500), nullable=True)
    custom_domain_annual_price = Column(Float, nullable=False, default=25.0)
    custom_domain_currency = Column(String(10), nullable=False, default="USD")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class EmailLog(Base):
    """Delivery ledger for system emails and retries."""

    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    recipient = Column(String(255), nullable=False)
    sender = Column(String(255), nullable=False)
    email_type = Column(String(80), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    body_preview = Column(Text, nullable=True)
    status = Column(String(40), nullable=False, default="pending", index=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class MasterDataRequest(Base):
    """Request queue for missing dropdown/master-data items during entry."""

    __tablename__ = "master_data_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_type = Column(String(80), nullable=False, index=True)
    suggested_name = Column(String(180), nullable=False)
    source_module = Column(String(120), nullable=True)
    note = Column(Text, nullable=True)
    status = Column(String(40), nullable=False, default="pending", index=True)
    requester_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class ReferenceDataType(str, enum.Enum):
    BATCH_BREED = "batch_breed"
    BIRD_TYPE = "bird_type"
    BATCH_SOURCE = "batch_source"
    MORTALITY_CAUSE = "mortality_cause"
    VACCINE = "vaccine"
    HOUSE_SECTION_TYPE = "house_section_type"
    FEED_TYPE = "feed_type"
    MEDICINE_TYPE = "medicine_type"
    EGG_GRADE = "egg_grade"
    SLAUGHTER_PART = "slaughter_part"
    BYPRODUCT_TYPE = "byproduct_type"
    EXPENSE_CATEGORY = "expense_category"
    PAYMENT_METHOD = "payment_method"
    UNIT_OF_MEASURE = "unit_of_measure"
    CUSTOMER_TYPE = "customer_type"


class ReferenceItem(Base):
    __tablename__ = "reference_items"
    __table_args__ = (
        UniqueConstraint("reference_type", "code", name="uq_reference_items_type_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    reference_type = Column(db_enum(ReferenceDataType, name="referencedatatype"), index=True, nullable=False)
    code = Column(String(100), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
