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
