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
	catRepo := repository.NewCategoryRepository(db)
	taskRepo := repository.NewTaskRepository(db)

	authService := service.NewAuthService(userRepo)
	taskService := service.NewTaskService(taskRepo, catRepo)

	authHandler := handler.NewAuthHandler(authService)
	catHandler := handler.NewCategoryHandler(catRepo)
	taskHandler := handler.NewTaskHandler(taskService)

	api := r.Group("/api/v1")

	// Public Routes
	api.POST("/auth/register", authHandler.Register)
	api.POST("/auth/login", authHandler.Login)

	// Protected Routes (Semua role yang sudah login)
	protected := api.Group("", middleware.AuthJWT(userRepo))
	protected.GET("/auth/me", authHandler.Me)

	// Group khusus USER
	user := protected.Group("", middleware.RequireRole("USER"))
	user.GET("/dashboard", taskHandler.Dashboard)

	user.GET("/categories", catHandler.GetAll)
	user.GET("/categories/:id", catHandler.GetByID)
	user.POST("/categories", catHandler.Create)
	user.PUT("/categories/:id", catHandler.Update)
	user.DELETE("/categories/:id", catHandler.Delete)

	user.GET("/tasks", taskHandler.GetAll)
	user.GET("/tasks/:id", taskHandler.GetByID)
	user.POST("/tasks", taskHandler.Create)
	user.PUT("/tasks/:id", taskHandler.Update)
	user.DELETE("/tasks/:id", taskHandler.Delete)

	// Group khusus ADMIN (nanti diisi di tahap berikutnya)
	_ = protected.Group("/admin", middleware.RequireRole("ADMIN"))

	return r
}