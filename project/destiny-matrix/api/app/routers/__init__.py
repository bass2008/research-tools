from . import (admin, auth, encyclopedia, health, leads, matrices, matrix, payments,
               reports)

ROUTERS = (health.router, matrix.router, auth.router, payments.router, matrices.router,
           encyclopedia.router, leads.router, admin.router, reports.router)

__all__ = ["ROUTERS", "admin", "auth", "encyclopedia", "health", "leads", "matrices", "matrix",
           "payments", "reports"]
