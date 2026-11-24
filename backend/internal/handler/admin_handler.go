package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"task-management-api/internal/dto"
	"task-management-api/internal/repository"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	adminRepo *repository.AdminRepository
}

func NewAdminHandler(adminRepo *repository.AdminRepository) *AdminHandler {
	return &AdminHandler{adminRepo: adminRepo}
}

func (h *AdminHandler) Dashboard(c *gin.Context) {
	summary, err := h.adminRepo.GetDashboardSummary(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data dashboard admin"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": summary})
}

func (h *AdminHandler) GetUsers(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter page tidak valid"})
		return
	}

	limit, err := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if err != nil || limit < 1 || limit > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter limit harus antara 1 sampai 100"})
		return
	}

	role := strings.ToUpper(strings.TrimSpace(c.Query("role")))
	if role != "" && role != "USER" && role != "ADMIN" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter role harus USER atau ADMIN"})
		return
	}

	var isActive *bool
	if activeStr := c.Query("is_active"); activeStr != "" {
		val, err := strconv.ParseBool(activeStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter is_active harus true/false atau 1/0"})
			return
		}
		isActive = &val
	}

	params := dto.AdminUserFilterParams{
		Page:      page,
		Limit:     limit,
		Search:    strings.TrimSpace(c.Query("search")),
		Role:      role,
		IsActive:  isActive,
		SortBy:    c.DefaultQuery("sort_by", "created_at"),
		SortOrder: c.DefaultQuery("sort_order", "DESC"),
	}

	res, err := h.adminRepo.GetUsers(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar pengguna"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *AdminHandler) GetUserDetail(c *gin.Context) {
	targetID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID user tidak valid"})
		return
	}

	detail, err := h.adminRepo.GetUserDetail(c.Request.Context(), targetID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail pengguna"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func (h *AdminHandler) UpdateUserRole(c *gin.Context) {
	targetID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID user tidak valid"})
		return
	}

	var req dto.UpdateUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Field role wajib diisi"})
		return
	}

	newRole := strings.ToUpper(strings.TrimSpace(req.Role))
	if newRole != "USER" && newRole != "ADMIN" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role harus USER atau ADMIN"})
		return
	}

	actorAdminID := c.MustGet("user_id").(int64)
	if err := h.adminRepo.UpdateUserRole(c.Request.Context(), actorAdminID, targetID, newRole); err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, repository.ErrCannotModifySelf) || errors.Is(err, repository.ErrLastActiveAdmin) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengubah role pengguna"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role pengguna berhasil diperbarui"})
}

func (h *AdminHandler) UpdateUserStatus(c *gin.Context) {
	targetID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID user tidak valid"})
		return
	}

	var req dto.UpdateUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.IsActive == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Field is_active (boolean) wajib diisi"})
		return
	}

	actorAdminID := c.MustGet("user_id").(int64)
	if err := h.adminRepo.UpdateUserStatus(c.Request.Context(), actorAdminID, targetID, *req.IsActive); err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, repository.ErrCannotModifySelf) || errors.Is(err, repository.ErrLastActiveAdmin) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengubah status pengguna"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status aktif pengguna berhasil diperbarui"})
}

func (h *AdminHandler) GetAllTasks(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter page tidak valid"})
		return
	}

	limit, err := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if err != nil || limit < 1 || limit > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter limit harus antara 1 sampai 100"})
		return
	}

	var filterUserID *int64
	if uidStr := c.Query("user_id"); uidStr != "" {
		uid, err := strconv.ParseInt(uidStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter user_id tidak valid"})
			return
		}
		filterUserID = &uid
	}

	status := strings.ToUpper(strings.TrimSpace(c.Query("status")))
	if status != "" && status != "TODO" && status != "IN_PROGRESS" && status != "DONE" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter status harus TODO, IN_PROGRESS, atau DONE"})
		return
	}

	priority := strings.ToUpper(strings.TrimSpace(c.Query("priority")))
	if priority != "" && priority != "LOW" && priority != "MEDIUM" && priority != "HIGH" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter priority harus LOW, MEDIUM, atau HIGH"})
		return
	}

	params := dto.AdminTaskFilterParams{
		Page:      page,
		Limit:     limit,
		Search:    strings.TrimSpace(c.Query("search")),
		UserID:    filterUserID,
		Status:    status,
		Priority:  priority,
		SortBy:    c.DefaultQuery("sort_by", "created_at"),
		SortOrder: c.DefaultQuery("sort_order", "DESC"),
	}

	res, err := h.adminRepo.GetAllTasks(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar task"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *AdminHandler) GetTaskByID(c *gin.Context) {
	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID task tidak valid"})
		return
	}

	task, err := h.adminRepo.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail task"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": task})
}