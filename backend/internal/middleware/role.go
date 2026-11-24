package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RequireRole(allowedRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Identitas pengguna tidak ditemukan"})
			return
		}

		userRole, ok := roleVal.(string)
		if !ok || userRole != allowedRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Anda tidak memiliki izin mengakses resource ini"})
			return
		}

		c.Next()
	}
}