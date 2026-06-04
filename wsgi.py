import sys
sys.path.insert(0, '/home/jrbissell/bella-demo')

from a2wsgi import ASGIMiddleware
from backend.app.main import app

application = ASGIMiddleware(app)
