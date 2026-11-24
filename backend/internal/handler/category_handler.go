package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"task-management-api/internal/dto"
	"task-management-api/internal/model"
	"task-management-api/internal/repository"

	"github.com/gin-gonic/gin"
)

type CategoryHandler struct {
	catRepo *repository.CategoryRepository
}

func NewCategoryHandler(catRepo *repository.CategoryRepository) *CategoryHandler {
	return &CategoryHandler{catRepo: catRepo}
}

func (h *CategoryHandler) Create(c *gin.Context) {
	var req dto.CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama kategori wajib diisi (maksimal 100 karakter)"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama kategori tidak boleh hanya spasi"})
		return
	}

	userID := c.MustGet("user_id").(int64)
	cat := &model.Category{
		UserID: userID,
		Name:   req.Name,
	}

	if err := h.catRepo.Create(c.Request.Context(), cat); err != nil {
		if errors.Is(err, repository.ErrCategoryAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat kategori"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": cat})
}

func (h *CategoryHandler) GetAll(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	categories, err := h.catRepo.FindAllByUserID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar kategori"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": categories})
}

func (h *CategoryHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID kategori tidak valid"})
		return
	}

	userID := c.MustGet("user_id").(int64)
	cat, err := h.catRepo.FindByIDAndUserID(c.Request.Context(), id, userID)
	if err != nil {
		if errors.Is(err, repository.ErrCategoryNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail kategori"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cat})
}

func (h *CategoryHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID kategori tidak valid"})
		return
	}

	var req dto.UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama kategori wajib diisi (maksimal 100 karakter)"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama kategori tidak boleh hanya spasi"})
		return
	}

	userID := c.MustGet("user_id").(int64)
	cat, err := h.catRepo.Update(c.Request.Context(), id, userID, req.Name)
	if err != nil {
		if errors.Is(err, repository.ErrCategoryNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, repository.ErrCategoryAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui kategori"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cat})
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID kategori tidak valid"})
		return
	}

	userID := c.MustGet("user_id").(int64)
	if err := h.catRepo.Delete(c.Request.Context(), id, userID); err != nil {
		if errors.Is(err, repository.ErrCategoryNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus kategori"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Kategori berhasil dihapus"})
}