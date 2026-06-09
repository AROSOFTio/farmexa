from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class SystemConfigBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class SystemConfigCreate(SystemConfigBase):
    pass

class SystemConfigOut(SystemConfigBase):
    id: int

    class Config:
        from_attributes = True

class ProductCatalogBase(BaseModel):
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    base_price: float = 0.0
    wholesale_price: float = 0.0
    is_active: bool = True

class ProductCatalogCreate(ProductCatalogBase):
    pass

class ProductCatalogOut(ProductCatalogBase):
    id: int

    class Config:
        from_attributes = True


class PublicSystemSettingsOut(BaseModel):
    system_name: str
    system_logo_url: Optional[str] = None
    system_favicon_url: Optional[str] = None
    primary_color: str
    secondary_color: str
    platform_domain: str
    tenant_domain_suffix: str
    sender_email: str
    sender_name: str
    support_email: str
    company_name: str
    footer_text: str

    class Config:
        from_attributes = True


class MasterDataRequestCreate(BaseModel):
    request_type: str
    suggested_name: str
    source_module: Optional[str] = None
    note: Optional[str] = None


class MasterDataRequestResolve(BaseModel):
    status: str
    resolution_note: Optional[str] = None


class MasterDataRequestOut(MasterDataRequestCreate):
    id: int
    status: str
    requester_user_id: Optional[int] = None
    resolved_by_user_id: Optional[int] = None
    resolution_note: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BranchBase(BaseModel):
    name: str
    branch_code: str
    type: str = "farm"
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: bool = True
    is_default: bool = False

class BranchCreate(BranchBase):
    pass

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    branch_code: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None

class BranchOut(BranchBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
