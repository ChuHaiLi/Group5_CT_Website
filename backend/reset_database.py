# reset_database.py
# Script để reset hoàn toàn database và migrations

import os
import shutil

def reset_database():
    print("🔄 Starting database reset...")
    
    # 1. Xóa database cũ
    db_path = 'instance/db.sqlite3'
    if os.path.exists(db_path):
        os.remove(db_path)
        print("✅ Deleted old database")
    else:
        print("ℹ️  No database found")
    
    # 2. Xóa thư mục migrations
    migrations_path = 'migrations'
    if os.path.exists(migrations_path):
        shutil.rmtree(migrations_path)
        print("✅ Deleted migrations folder")
    else:
        print("ℹ️  No migrations folder found")
    
    print("\n✅ Database reset complete!")
    print("\n📝 Next steps:")
    print("1. Run: flask db init")
    print("2. Run: flask db migrate -m 'Initial migration'")
    print("3. Run: flask db upgrade")
    print("4. Run: python seed.py")

if __name__ == "__main__":
    response = input("⚠️  This will DELETE all data. Continue? (yes/no): ")
    if response.lower() == 'yes':
        reset_database()
    else:
        print("❌ Operation cancelled")