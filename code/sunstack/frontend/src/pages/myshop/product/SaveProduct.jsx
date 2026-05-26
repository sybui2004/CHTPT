"use client"

import { useState, useEffect } from "react"
import { BASE_API_URL } from "../../../constants/index.js"
import { fetchWithAuth } from "../../../util/AuthUtil.js"
import { uploadImage, uploadImages } from "../../../util/UploadUtil.js"
import { FaUpload, FaTimes, FaPlus, FaTrash } from "react-icons/fa"
import { ToastContainer, toast } from "react-toastify"
import { FiPackage, FiSearch, FiTag, FiTruck, FiEye, FiSave, FiImage, FiGrid } from "react-icons/fi"

// Section is defined outside to prevent React treating it as new component type on each render
function Section({ icon, title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
        <span className="text-orange-500">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-colors"
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"

const formatNumber = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (!digits) return ""
  return Number(digits).toLocaleString("vi-VN")
}

const parseFormattedNumber = (value) => String(value ?? "").replace(/\D/g, "")
const toNumberOrEmpty = (value) => {
  const digits = parseFormattedNumber(value)
  return digits === "" ? "" : Number(digits)
}

const numericInputProps = {
  type: "text",
  inputMode: "numeric",
  autoComplete: "off",
}

export default function SaveProduct({ curProduct }) {

  const curSkuList = curProduct?.skuList || []
  const curMediaList = curProduct?.mediaList || []

  const [productDetails, setProductDetails] = useState({
    name: curProduct ? curProduct.name : "",
    description: curProduct ? curProduct.description : "",
    thumbnailUrl: curProduct ? curProduct.thumbnailUrl : "",
    price: curProduct ? curProduct.price : "",
    quantity: curProduct ? curProduct.quantity : "",
    weight: curProduct ? curProduct.weight : "",
    visible: curProduct ? curProduct.visible : true,
  })

  const updateProductDetails = (field, value) => {
    setProductDetails((prevDetails) => ({
      ...prevDetails,
      [field]: value,
    }))
  }

  const [galleryImages, setGalleryImages] = useState(
    curProduct ? curMediaList.map(media => ({ id: media.id, url: media.url })) : []
  )
  const [variantAttributes, setVariantAttributes] = useState(
    curProduct ? extractAttributes(curSkuList) : []
  )
  const [variants, setVariants] = useState(
    curProduct ? curSkuList.map(sku => ({
      id: sku.id,
      attributes: sku.attributes,
      price: sku.price,
      quantity: sku.quantity,
      sku: sku.sku
    })) : []
  )
  const [isUploading, setIsUploading] = useState(false)

  const buildProductPayload = (details = productDetails, gallery = galleryImages, skuVariants = variants) => {
    const mediaList = gallery.map((img) => ({ id: img.id, url: img.url, type: "IMAGE" }))
    const normalizedVariants = skuVariants.map(variant => ({
      ...variant,
      price: toNumberOrEmpty(variant.price),
      quantity: toNumberOrEmpty(variant.quantity),
    }))
    const variantPrices = normalizedVariants
      .map(variant => variant.price)
      .filter(price => price !== "")
    const variantQuantities = normalizedVariants
      .map(variant => variant.quantity)
      .filter(quantity => quantity !== "")
    return {
      ...details,
      price: skuVariants.length === 0 ? toNumberOrEmpty(details.price) : (variantPrices.length ? Math.min(...variantPrices) : 0),
      quantity: skuVariants.length === 0 ? toNumberOrEmpty(details.quantity) : variantQuantities.reduce((total, quantity) => total + quantity, 0),
      weight: toNumberOrEmpty(details.weight),
      productId: curProduct ? curProduct.id : null,
      mediaList,
      skuList: normalizedVariants,
    }
  }

  const persistEditedProductImages = (details = productDetails, gallery = galleryImages) => {
    if (!curProduct) return
    fetchWithAuth(`${BASE_API_URL}/v1/shop/product/update`, window.location, true, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildProductPayload(details, gallery)),
    })
      .then((res) => {
        if (!res.ok) res.json().then(data => toast.error(data.message))
        else toast.success("Đã cập nhật ảnh sản phẩm!")
      })
      .catch(() => toast.error("Ảnh đã tải lên nhưng chưa lưu được vào sản phẩm"))
  }

  function extractAttributes(skuList) {
    const attributeMap = new Map();
    skuList.forEach(sku => {
      sku.attributes.forEach(attr => {
        if (!attributeMap.has(attr.name)) attributeMap.set(attr.name, new Set());
        attributeMap.get(attr.name).add(attr.value);
      });
    });
    return Array.from(attributeMap, ([name, values]) => ({ name, values: Array.from(values) }));
  }

  const handleAddAttribute = () => setVariantAttributes([...variantAttributes, { name: "", values: [] }])

  const getAttributeKey = (attributes) =>
    attributes.map(attr => `${attr.name}:${attr.value}`).sort().join("|")

  const generateVariantCombinations = (attributes = variantAttributes, currentVariants = variants) => {
    const usableAttributes = attributes.filter(attribute => attribute.name.trim() && attribute.values.length > 0)
    if (usableAttributes.length === 0) {
      setVariants([])
      return
    }

    const existingByAttributes = new Map(
      currentVariants.map(variant => [
        getAttributeKey(variant.attributes),
        variant
      ])
    )
    const combinations = usableAttributes.reduce((acc, attribute) => {
      if (acc.length === 0) return attribute.values.map((value) => [{ name: attribute.name, value }])
      return acc.flatMap((combination) =>
        attribute.values.map((value) => [...combination, { name: attribute.name, value }]),
      )
    }, [])
    setVariants(combinations.map((combination) => {
      const existing = existingByAttributes.get(getAttributeKey(combination))
      return existing ? { ...existing, attributes: combination } : { attributes: combination, price: "", quantity: "", sku: "" }
    }))
  }

  const handleAttributeNameChange = (index, name) => {
    const updated = variantAttributes.map((attribute, attrIndex) => attrIndex === index ? { ...attribute, name } : attribute)
    setVariantAttributes(updated)
    generateVariantCombinations(updated, variants)
  }

  const handleAddAttributeValue = (index, value) => {
    const normalizedValue = value.trim()
    if (!normalizedValue) return
    const updated = variantAttributes.map((attribute, attrIndex) => {
      if (attrIndex !== index) return attribute
      if (attribute.values.includes(normalizedValue)) return attribute
      return { ...attribute, values: [...attribute.values, normalizedValue] }
    })
    setVariantAttributes(updated)
    generateVariantCombinations(updated, variants)
  }

  const handleDeleteAttribute = (index) => {
    const updated = variantAttributes.filter((_, i) => i !== index)
    setVariantAttributes(updated)
    generateVariantCombinations(updated, variants)
  }

  const handleDeleteAttributeValue = (attrIndex, valueIndex) => {
    const updated = variantAttributes.map((attribute, index) => {
      if (index !== attrIndex) return attribute
      return { ...attribute, values: attribute.values.filter((_, i) => i !== valueIndex) }
    })
    setVariantAttributes(updated)
    generateVariantCombinations(updated, variants)
  }

  const handleAutoGenerateSKUs = () => {
    const toAsciiUpper = (input) =>
      String(input || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toUpperCase()

    const base = toAsciiUpper(productDetails.name).slice(0, 12) || "SKU"
    const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase()

    const updated = variants.map((v, idx) => {
      const attrPart = toAsciiUpper((v.attributes || []).map(a => a.value).join("-"))
      const sku = [base, attrPart, String(idx + 1).padStart(2, "0"), rand()].filter(Boolean).join("-")
      return { ...v, sku }
    })

    setVariants(updated)
    toast.info("Đã tạo SKU tự động")
  }

  const handleVariantChange = (index, field, value) => {
    const updated = [...variants]; updated[index][field] = value; setVariants(updated)
  }

  const handleAddGallery = async (galleries) => {
    if (galleries.length + galleryImages.length > 9) { toast.warning("Tối đa 9 ảnh gallery"); return }
    try {
      const urls = await uploadImages(galleries)
      const tmp = [...galleryImages, ...urls.map((url) => ({ url }))]
      setGalleryImages(tmp)
      persistEditedProductImages(productDetails, tmp)
    } catch (error) {
      toast.error(error.message || "Khong the tai anh len")
    }
  }

  const handleThumbnailUpload = async (file) => {
    if (!file) return
    setIsUploading(true)
    try {
      const url = await uploadImage(file)
      if (url) {
        const nextDetails = { ...productDetails, thumbnailUrl: url }
        setProductDetails(nextDetails)
        persistEditedProductImages(nextDetails, galleryImages)
      }
    } catch (error) {
      toast.error(error.message || "Khong the tai anh len")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveGallery = (index) => {
    const nextGallery = galleryImages.filter((_, i) => i !== index)
    setGalleryImages(nextGallery)
    persistEditedProductImages(productDetails, nextGallery)
  }

  const handleAddProduct = () => {
    const skuStrings = variants.map(v => v.sku).filter(s => s && s.trim() !== "")
    if (new Set(skuStrings).size !== skuStrings.length) {
      toast.error("Mã SKU không được trùng nhau giữa các phân loại"); return
    }

    const product = buildProductPayload()

    fetchWithAuth(`${BASE_API_URL}/v1/shop/product/${curProduct ? 'update' : 'add'}`, window.location, true, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    })
      .then((res) => {
        if (!res.ok) { res.json().then(data => toast.error(data.message)) }
        else { toast.success("Đã lưu sản phẩm!"); setTimeout(() => window.location.assign("/myshop/product-list"), 1200) }
      })
      .catch(() => toast.error("Có lỗi xảy ra, vui lòng thử lại sau!"))
  }

  return (
    <div className="w-full space-y-4">

      {/* Page header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FiPackage className="text-orange-500" size={20} />
            {curProduct ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {curProduct ? "Cập nhật thông tin sản phẩm" : "Điền đầy đủ thông tin để đăng sản phẩm"}
          </p>
        </div>
      </div>

      {/* Basic info */}
      <Section icon={<FiTag size={15} />} title="Thông tin cơ bản">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Tên sản phẩm</label>
            <input
              type="text"
              value={productDetails.name}
              onChange={(e) => updateProductDetails("name", e.target.value)}
              placeholder="Nhập tên sản phẩm..."
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Mô tả sản phẩm</label>
            <textarea
              value={productDetails.description}
              onChange={(e) => updateProductDetails("description", e.target.value)}
              placeholder="Mô tả chi tiết sản phẩm..."
              rows={5}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      </Section>

      {/* Thumbnail & Gallery */}
      <Section icon={<FiImage size={15} />} title="Hình ảnh sản phẩm">
        {/* Thumbnail */}
        <div className="mb-5">
          <label className={labelCls}>Ảnh đại diện</label>
          <div className="flex items-start gap-4 flex-wrap">
            {productDetails.thumbnailUrl ? (
              <div className="relative">
                <img
                  src={productDetails.thumbnailUrl}
                  alt="Thumbnail"
                  className="w-28 h-28 object-cover rounded-xl border border-gray-200 shadow-sm"
                />
                <button
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 cursor-pointer shadow"
                  onClick={() => {
                    const nextDetails = { ...productDetails, thumbnailUrl: "" }
                    setProductDetails(nextDetails)
                    persistEditedProductImages(nextDetails, galleryImages)
                  }}
                >
                  <FaTimes size={9} />
                </button>
              </div>
            ) : null}
            <label
              htmlFor="thumbnailUpload"
              className={`w-28 h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors ${productDetails.thumbnailUrl ? "hidden" : ""}`}
            >
              <FaUpload size={18} className="text-gray-300 mb-1" />
              <span className="text-xs text-gray-400">Tải ảnh lên</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="thumbnailUpload"
                onChange={e => handleThumbnailUpload(e.target.files[0])}
              />
            </label>
            {productDetails.thumbnailUrl && (
              <label htmlFor="thumbnailUpload" className="flex items-center gap-1.5 text-sm text-orange-500 border border-orange-200 rounded-lg px-3 py-2 hover:bg-orange-50 cursor-pointer">
                <FaUpload size={12} /> Đổi ảnh
                <input type="file" accept="image/*" className="hidden" id="thumbnailUpload"
                  onChange={e => handleThumbnailUpload(e.target.files[0])}
                />
              </label>
            )}
          </div>
        </div>

        {/* Gallery */}
        <div>
          <label className={labelCls}>Ảnh trưng bày ({galleryImages.length}/9)</label>
          <div className="flex flex-wrap gap-3">
            {galleryImages.map((imgUrl, index) => (
              <div key={index} className="relative">
                <img
                  src={imgUrl.url}
                  alt={`Gallery ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm"
                />
                <button
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 cursor-pointer shadow"
                  onClick={() => handleRemoveGallery(index)}
                >
                  <FaTimes size={8} />
                </button>
              </div>
            ))}
            {galleryImages.length < 9 && (
              <label
                htmlFor="galleryUpload"
                className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
              >
                <FaPlus size={14} className="text-gray-300" />
                <span className="text-xs text-gray-400 mt-0.5">Thêm</span>
                <input type="file" multiple accept="image/*" className="hidden" id="galleryUpload"
                  onChange={(e) => handleAddGallery([...e.target.files])}
                />
              </label>
            )}
          </div>
        </div>
      </Section>

      {/* Variants / Classifications */}
      <Section icon={<FiGrid size={15} />} title="Phân loại hàng">
        {variantAttributes.map((attribute, index) => (
          <div key={index} className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={attribute.name}
                onChange={(e) => handleAttributeNameChange(index, e.target.value)}
                placeholder="Tên phân loại (VD: Size, Màu sắc...)"
                className={`flex-1 ${inputCls}`}
              />
              <button
                onClick={() => handleDeleteAttribute(index)}
                className="p-2.5 text-red-500 hover:bg-red-50 border border-red-200 rounded-lg cursor-pointer transition-colors"
              >
                <FaTrash size={12} />
              </button>
            </div>
            <input
              type="text"
              onKeyDown={(e) => {
                if (e.key === "Enter") { handleAddAttributeValue(index, e.target.value); e.target.value = "" }
              }}
              placeholder="Nhập giá trị rồi nhấn Enter để thêm..."
              className={`${inputCls} mb-3`}
            />
            <div className="flex flex-wrap gap-2">
              {attribute.values.map((value, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1 rounded-full text-xs text-gray-700">
                  {value}
                  <button
                    onClick={() => handleDeleteAttributeValue(index, i)}
                    className="text-gray-400 hover:text-red-500 cursor-pointer"
                  >
                    <FaTimes size={9} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={handleAddAttribute}
          className="flex items-center gap-2 px-4 py-2 border border-dashed border-orange-300 text-orange-500 text-sm rounded-xl hover:bg-orange-50 cursor-pointer transition-colors"
        >
          <FaPlus size={12} /> Thêm phân loại
        </button>
      </Section>

      {/* Variants table or default price/qty */}
      {variants.length > 0 ? (
        <Section
          icon={<FiTag size={15} />}
          title={
            <div className="flex items-center justify-between w-full">
              <span>Bảng phân loại & giá</span>
              <button
                onClick={handleAutoGenerateSKUs}
                className="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded hover:bg-orange-200 transition-colors cursor-pointer font-bold uppercase tracking-wider"
              >
                Tạo SKU tự động
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {variantAttributes.map((attr) => (
                    <th key={attr.name} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {attr.name}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">Giá (₫)</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[100px]">Số lượng</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[110px]">SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {variants.map((variant, index) => (
                  <tr key={index} className="hover:bg-gray-50/50">
                    {variant.attributes.map((attr, i) => (
                      <td key={i} className="px-3 py-2.5 text-sm text-gray-600 font-medium">
                        {attr.value}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <input
                        {...numericInputProps}
                        value={formatNumber(variant.price)}
                        onChange={(e) => handleVariantChange(index, "price", parseFormattedNumber(e.target.value))}
                        placeholder="VD: 150.000"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 transition-colors"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        {...numericInputProps}
                        value={formatNumber(variant.quantity)}
                        onChange={(e) => handleVariantChange(index, "quantity", parseFormattedNumber(e.target.value))}
                        placeholder="VD: 100"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 transition-colors"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={variant.sku}
                        onChange={(e) => handleVariantChange(index, "sku", e.target.value)}
                        placeholder="SKU-001"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-orange-400 transition-colors"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Section icon={<FiTag size={15} />} title="Giá & Kho hàng">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Giá bán (₫)</label>
              <input
                {...numericInputProps}
                value={formatNumber(productDetails.price)}
                onChange={(e) => updateProductDetails("price", parseFormattedNumber(e.target.value))}
                placeholder="VD: 150.000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Số lượng trong kho</label>
              <input
                {...numericInputProps}
                value={formatNumber(productDetails.quantity)}
                onChange={(e) => updateProductDetails("quantity", parseFormattedNumber(e.target.value))}
                placeholder="VD: 100"
                className={inputCls}
              />
            </div>
          </div>
        </Section>
      )}

      {/* Shipping */}
      <Section icon={<FiTruck size={15} />} title="Vận chuyển">
        <div className="max-w-xs">
          <label className={labelCls}>Cân nặng (gram)</label>
          <input
            {...numericInputProps}
            value={formatNumber(productDetails.weight)}
            onChange={(e) => updateProductDetails("weight", parseFormattedNumber(e.target.value))}
            placeholder="VD: 500"
            className={inputCls}
          />
          <p className="text-xs text-gray-400 mt-1.5">Dùng để tính phí vận chuyển</p>
        </div>
      </Section>

      {/* Visibility */}
      <Section icon={<FiEye size={15} />} title="Chế độ hiển thị">
        <div className="flex items-center gap-6">
          {[{ label: "Hiển thị công khai", value: true }, { label: "Ẩn sản phẩm", value: false }].map(({ label, value }) => (
            <label key={String(value)} className="flex items-center gap-2.5 cursor-pointer group">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${productDetails.visible === value ? "border-orange-500 bg-orange-500" : "border-gray-300"
                  }`}
                onClick={() => updateProductDetails("visible", value)}
              >
                {productDetails.visible === value && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* Bottom save button */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleAddProduct}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors shadow-sm cursor-pointer"
        >
          <FiSave size={16} /> {curProduct ? "Cập nhật sản phẩm" : "Đăng sản phẩm"}
        </button>
      </div>

      <ToastContainer position="bottom-right" />
    </div>
  )
}
