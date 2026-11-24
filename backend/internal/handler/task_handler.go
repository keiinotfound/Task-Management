package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"task-management-api/internal/dto"
	"task-management-api/internal/repository"
	"task-management-api/internal/service"

	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	taskService *service.TaskService
}

func NewTaskHandler(taskService *service.TaskService) *TaskHandler {
	return &TaskHandler{taskService: taskService}
}

func (h *TaskHandler) Create(c *gin.Context) {
	var req dto.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid (title wajib diisi, maksimal 200 karakter)"})
		return
	}

	userID := c.MustGet("user_id").(int64)
	task, err := h.taskService.CreateTask(c.Request.Context(), userID, req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidPriority) ||
			errors.Is(err, service.ErrInvalidStatus) ||
			errors.Is(err, service.ErrInvalidDueDate) ||
			errors.Is(err, service.ErrCategoryOwnershipFail) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat task"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": task})
}

func (h *TaskHandler) GetAll(c *gin.Context) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter page harus berupa angka >= 1"})
		return
	}

	limit, err := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if err != nil || limit < 1 || limit > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameter limit harus antara 1 sampai 100"})
		return
	}

	var categoryID *int64
	if catStr := c.Query("category_id"); catStr != "" {
		cid, err := strconv.ParseInt(catStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "category_id tidak valid"})
			return
		}
		categoryID = &cid
	}

	params := dto.TaskFilterParams{
		Page:       page,
		Limit:      limit,
		Search:     strings.TrimSpace(c.Query("search")),
		Status:     c.Query("status"),
		Priority:   c.Query("priority"),
		CategoryID: categoryID,
		SortBy:     c.DefaultQuery("sort_by", "created_at"),
		SortOrder:  c.DefaultQuery("sort_order", "DESC"),
	}

	userID := c.MustGet("user_id").(int64)
	res, err := h.taskService.GetTasks(c.Request.Context(), userID, params)
	if err != nil {
		if errors.Is(err, service.ErrInvalidPriority) || errors.Is(err, service.ErrInvalidStatus) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar task"})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *TaskHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID task tidak valid"})
		return
	}

	userID := c.MustGet("user_id").(int64)
	task, err := h.taskService.GetTaskByID(c.Request.Context(), id, userID)
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

func (h *TaskHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID task tidak valid"})
		return
	}

	var req dto.UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input tidak valid (title, priority, dan status wajib diisi)"})
		return
	}

	userID := c.MustGet("user_id").(int64)
	task, err := h.taskService.UpdateTask(c.Request.Context(), id, userID, req)
	if err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, service.ErrInvalidPriority) ||
			errors.Is(err, service.ErrInvalidStatus) ||
			errors.Is(err, service.ErrInvalidDueDate) ||
			errors.Is(err, service.ErrCategoryOwnershipFail) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": task})
}

func (h *TaskHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID task tidak valid"})
		return
	}

	userID := c.MustGet("user_id").(int64)
	if err := h.taskService.DeleteTask(c.Request.Context(), id, userID); err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task berhasil dihapus"})
}

func (h *TaskHandler) Dashboard(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	summary, err := h.taskService.GetDashboard(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data dashboard"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summary})
}