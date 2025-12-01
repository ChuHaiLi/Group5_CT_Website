"""Added geographical hierarchy (Region, Province) and DestinationImage

Revision ID: 215d5727909d
Revises: 
Create Date: 2025-12-01 22:06:40.854190

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

# revision identifiers, used by Alembic.
revision = '215d5727909d'
down_revision = None
branch_labels = None
depends_on = None

FOREIGN_KEY_NAME = 'fk_destination_province' 

def upgrade():
    # LƯU Ý: ĐÃ XÓA CÁC LỆNH op.create_table VÌ CHÚNG GÂY RA LỖI "table already exists".
    # Giả định các bảng 'region', 'province', 'destination_image' ĐÃ CÓ.

    # ### 1. THÊM CÁC CỘT VÀO DESTINATION (TẠM THỜI NULL) ###
    with op.batch_alter_table('destination', schema=None) as batch_op:
        # province_id TẠM THỜI nullable=True
        batch_op.add_column(sa.Column('province_id', sa.Integer(), nullable=True))
        
        # Thêm các cột chi tiết
        batch_op.add_column(sa.Column('place_type', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('opening_hours', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('entry_fee', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('source', sa.String(length=255), nullable=True))
        
    # ### 2. ĐIỀN DỮ LIỆU VÀO CỘT MỚI VÀ TẠO RÀNG BUỘC ###
    
    # Bước điền dữ liệu (CẦN PHẢI CHẠY TRƯỚC LỆNH nullable=False)
    # Giả định ID 1 là một Province hợp lệ (ví dụ: Hà Nội)
    op.execute("UPDATE destination SET province_id = 1 WHERE province_id IS NULL")
    
    with op.batch_alter_table('destination', schema=None) as batch_op:
        # Thêm Khóa ngoại (sau khi đã điền dữ liệu)
        batch_op.create_foreign_key(FOREIGN_KEY_NAME, 'province', ['province_id'], ['id'])
        
        # Thiết lập lại cột province_id thành NOT NULL (Sau khi đã điền dữ liệu)
        batch_op.alter_column('province_id', 
                              existing_type=sa.Integer(), 
                              nullable=False, 
                              existing_server_default=None)

    # ### end Alembic commands ###


def downgrade():
    # ### LƯU Ý: CHỈ XÓA THAY ĐỔI TRÊN BẢNG DESTINATION, KHÔNG XÓA CÁC BẢNG REGION, PROVINCE ###
    
    with op.batch_alter_table('destination', schema=None) as batch_op:
        # Xóa ràng buộc Khóa ngoại
        batch_op.drop_constraint(FOREIGN_KEY_NAME, type_='foreignkey')
        
        # Xóa các cột đã thêm
        batch_op.drop_column('source')
        batch_op.drop_column('entry_fee')
        batch_op.drop_column('opening_hours')
        batch_op.drop_column('place_type')
        # Xóa cột province_id cuối cùng
        batch_op.drop_column('province_id')

    # op.drop_table('destination_image') # Không cần xóa nếu không tạo
    # op.drop_table('province') 
    # op.drop_table('region')
    
    # ### end Alembic commands ###