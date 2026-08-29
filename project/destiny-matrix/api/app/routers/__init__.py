from . import admin, auth, health, leads, matrices, payments, reports

ROUTERS = (health.router, auth.router, payments.router, matrices.router,
           leads.router, admin.router, reports.router)

__all__ = ["ROUTERS", "admin", "auth", "health", "leads", "matrices", "payments", "reports"]
