from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, Text, func
from datetime import datetime
from app.config import settings


engine = create_async_engine(f"sqlite+aiosqlite:///{settings.db_path}", echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[str] = mapped_column(String(500), default="Unknown")
    description: Mapped[str] = mapped_column(Text, default="")
    publisher: Mapped[str] = mapped_column(String(255), default="")
    language: Mapped[str] = mapped_column(String(50), default="")
    isbn: Mapped[str] = mapped_column(String(50), default="")
    tags: Mapped[str] = mapped_column(Text, default="")  # comma-separated
    cover_path: Mapped[str] = mapped_column(String(500), default="")
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_format: Mapped[str] = mapped_column(String(20), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    added_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
