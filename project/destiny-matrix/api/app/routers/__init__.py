from . import admin, auth, health, matrices, payments, readings, reports, notifications, individual_readings, individual_orders

ROUTERS = (health.router, auth.router, payments.router, matrices.router, readings.router,
           admin.router, reports.router, notifications.router, individual_readings.router,
           individual_orders.router)

__all__ = ["ROUTERS", "admin", "auth", "health", "matrices", "payments", "readings", "reports"]
