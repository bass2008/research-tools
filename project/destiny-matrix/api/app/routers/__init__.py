from . import auth, encyclopedia, health, leads, matrices, matrix, payments

ROUTERS = (health.router, matrix.router, auth.router, payments.router, matrices.router,
           encyclopedia.router, leads.router)

__all__ = ["ROUTERS", "auth", "encyclopedia", "health", "leads", "matrices", "matrix", "payments"]
