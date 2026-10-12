from . import admin, auth, health, matrices, payments, readings, reports, tasks

ROUTERS = (health.router, auth.router, payments.router, matrices.router, readings.router,
           admin.router, reports.router, tasks.router)

__all__ = ["ROUTERS", "admin", "auth", "health", "matrices", "payments", "readings", "reports", "tasks"]
