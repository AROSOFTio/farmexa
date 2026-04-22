from sqlalchemy import Column, Integer, String, Float, Text, Boolean
from app.db.base import Base

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
