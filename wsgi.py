import sys
sys.path.insert(0, '/home/jrbissell/bella-demo')

from backend.app.database import create_tables
create_tables()

from a2wsgi import ASGIMiddleware
from backend.app.main import app

application = ASGIMiddleware(app, lifespan="off")
