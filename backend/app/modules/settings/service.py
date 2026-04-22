from sqlalchemy.orm import Session
from app.models.settings import SystemConfig, ProductCatalog
from . import schemas

class SettingsService:
    def get_configs(self, db: Session):
        return db.query(SystemConfig).all()

    def get_config_by_key(self, db: Session, key: str):
        return db.query(SystemConfig).filter(SystemConfig.key == key).first()

    def set_config(self, db: Session, config: schemas.SystemConfigCreate):
        db_config = self.get_config_by_key(db, config.key)
        if db_config:
            db_config.value = config.value
            if config.description:
                db_config.description = config.description
        else:
            db_config = SystemConfig(**config.model_dump())
            db.add(db_config)
        db.commit()
        db.refresh(db_config)
        return db_config

    def get_products(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(ProductCatalog).offset(skip).limit(limit).all()

    def create_product(self, db: Session, product: schemas.ProductCatalogCreate):
        db_prod = ProductCatalog(**product.model_dump())
        db.add(db_prod)
        db.commit()
        db.refresh(db_prod)
        return db_prod

settings_service = SettingsService()
