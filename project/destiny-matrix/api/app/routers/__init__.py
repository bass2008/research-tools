from . import admin, auth, health, matrices, payments, reports

ROUTERS = (health.router, auth.router, payments.router, matrices.router,
           admin.router, reports.router)

__all__ = ["ROUTERS", "admin", "auth", "health", "matrices", "payments", "reports"]
