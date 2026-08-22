from utils.db_utils import SQLManager


def dump_table(name):
    db = SQLManager()
    try:
        print(f"\n=== dbo.{name} ===")
        res = db.execute_query('EXEC dbo.SP_SYS_GET_TABLE_COLUMNS ?', (name,))
        rows = res.get('data', [])
        if not rows:
            print('Table not found')
            return
        for r in rows:
            col_name = r.get('COLUMN_NAME')
            type_name = r.get('DATA_TYPE')
            max_len = r.get('CHARACTER_MAXIMUM_LENGTH')
            prec = r.get('NUMERIC_PRECISION')
            scale = r.get('NUMERIC_SCALE')
            null_flag = r.get('IS_NULLABLE')
            print(f"{col_name:30} {type_name:12} len={max_len!s:4} prec={prec!s:3} scale={scale!s:3} null={null_flag}")
    finally:
        db.close_connection()

if __name__ == '__main__':
    dump_table('TBL_EQUIPMENT_HEIGHT_SETTING')
