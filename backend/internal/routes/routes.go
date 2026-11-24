package routes

import (
	"database/sql"
	"net/http"

	"task-management-api/internal/handler"
	"task-management-api/internal/middleware"
	"task-management-api/internal/repository"
	"task-management-api/internal/service"

	"github.com/gin-gonic/gin"
)

func SetupRouter(db *sql.DB) *gin.Engine {
	r := gin.Default()

	// CORS Middleware sederhana untuk integrasi Frontend (Bagian 10.1)
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Dependency Injection
	userRepo := repository.NewUserRepository(db)
	authService := service.NewAuthService(userRepo)
	authHandler := handler.NewAuthHandler(authService)

	api := r.Group("/api/v1")

	// Public Routes
	api.POST("/auth/register", authHandler.Register)
	api.POST("/auth/login", authHandler.Login)

	// Protected Routes (Semua role yang sudah login)
	protected := api.Group("", middleware.AuthJWT(userRepo))
	protected.GET("/auth/me", authHandler.Me)

	// Group khusus USER (nanti diisi di tahap berikutnya)
	_ = protected.Group("", middleware.RequireRole("USER"))

	// Group khusus ADMIN (nanti diisi di tahap berikutnya)
	_ = protected.Group("/admin", middleware.RequireRole("ADMIN"))

	return r
}