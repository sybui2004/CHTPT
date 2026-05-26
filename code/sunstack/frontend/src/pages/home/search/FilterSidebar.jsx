import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiFilterLine, RiPriceTag3Line } from 'react-icons/ri';
import { BASE_API_URL } from '../../../constants';
import { FaStar } from "react-icons/fa";
import { FiSearch, FiX } from "react-icons/fi";
import { fetchWithAuth } from '../../../util/AuthUtil';

const POPULAR_LOCATIONS = [
  'Thành phố Hà Nội',
  'Thành phố Hồ Chí Minh',
  'Thành phố Đà Nẵng',
  'Thành phố Hải Phòng',
  'Thành phố Cần Thơ',
  'Tỉnh Bình Dương',
  'Tỉnh Đồng Nai',
  'Tỉnh Bà Rịa - Vũng Tàu'
];

const normalizeText = (value = '') => value
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .trim();

const getLocationSearchName = (name = '') => normalizeText(name)
  .replace(/^(tinh|thanh pho)\s+/, '')
  .trim();

const sortByName = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

export default function FilterSidebar({filters, setFilters, resetFilters}){

  const [priceRange, setPriceRange] = useState({
    min: filters.minPrice || '',
    max: filters.maxPrice || ''
  });

  const [locations, setLocations] = useState([])
  const [userLocationNames, setUserLocationNames] = useState([])
  const [userDistrictOptions, setUserDistrictOptions] = useState([])
  const [checkedDistrictLabels, setCheckedDistrictLabels] = useState([])
  const [locationSearch, setLocationSearch] = useState('')
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false)

  const [errorPriceRange, setErrorPriceRange] = useState(false)

  const toggleLocation = (locationName, checked) => {
    setFilters(prev => ({
      ...prev,
      locations: checked
        ? Array.from(new Set([...(prev.locations || []), locationName]))
        : (prev.locations || []).filter(locName => locName !== locationName)
    }));
  }

  const togglePriorityLocation = (option, checked) => {
    if (option.type === 'district') {
      const nextCheckedDistrictLabels = checked
        ? Array.from(new Set([...checkedDistrictLabels, option.id]))
        : checkedDistrictLabels.filter(id => id !== option.id)
      const hasSameProvinceDistrictChecked = nextCheckedDistrictLabels.some(id => {
        const districtOption = userDistrictOptions.find(item => item.id === id)
        return districtOption?.value === option.value
      })

      setCheckedDistrictLabels(nextCheckedDistrictLabels)

      if (!checked && hasSameProvinceDistrictChecked) return
    }
    else if (!checked) {
      setCheckedDistrictLabels(prev => prev.filter(id => {
        const districtOption = userDistrictOptions.find(item => item.id === id)
        return districtOption?.value !== option.value
      }))
    }

    toggleLocation(option.value, checked)
  }

  const handlePriceChange = () => {
    setErrorPriceRange(false)
    if(priceRange.min && priceRange.max && priceRange.min > priceRange.max){
      setErrorPriceRange(true)
      return
    }
    if(!priceRange.min && !priceRange.max){
      setErrorPriceRange(true)
      return
    }
    if(priceRange.min){
      setFilters(prev => ({
        ...prev,
        minPrice: priceRange.min
      }))
    }
    if(priceRange.max){
      setFilters(prev => ({
        ...prev,
        maxPrice: priceRange.max
      }))
    }
  }

  useEffect(() => {
    const fetchLocations = () => {
      fetch(`${BASE_API_URL}/v1/homepage/get_locations_filter`)
        .then(res => res.json())
        .then(res => setLocations(res))
    }

    const fetchUserLocations = () => {
      if (!localStorage.getItem("access_token")) return

      fetchWithAuth(`${BASE_API_URL}/v1/user/address/get-list`, window.location, false)
        .then(res => res?.ok ? res.json() : [])
        .then(async res => {
          const addresses = Array.isArray(res) ? res : []
          const primaryAddress = addresses.find(address => address.primary)
          const orderedAddresses = primaryAddress
            ? [primaryAddress, ...addresses.filter(address => address.id !== primaryAddress.id)]
            : addresses
          const provinceNames = Array.from(new Set(
            orderedAddresses
              .map(address => address.province?.name)
              .filter(Boolean)
          ))

          setUserLocationNames(provinceNames)

          const provinceDistricts = await Promise.all(
            orderedAddresses
              .filter(address => address.province?.id && address.province?.name)
              .map(address => fetchWithAuth(`${BASE_API_URL}/v1/address/districts?provinceId=${address.province.id}`, window.location, false)
                .then(districtRes => districtRes?.ok ? districtRes.json() : [])
                .then(districts => ({
                  provinceName: address.province.name,
                  districts: Array.isArray(districts) ? districts : []
                }))
                .catch(() => ({ provinceName: address.province.name, districts: [] }))
              )
          )

          const districtOptions = []
          const pickedDistrictKeys = new Set()

          provinceDistricts.forEach(({ provinceName, districts }) => {
            districts.forEach(district => {
              const key = `${normalizeText(provinceName)}-${normalizeText(district.name)}`
              if (!pickedDistrictKeys.has(key)) {
                pickedDistrictKeys.add(key)
                districtOptions.push({
                  id: key,
                  label: district.name,
                  value: provinceName,
                  type: 'district'
                })
              }
            })
          })

          setUserDistrictOptions(districtOptions)
        })
        .catch(() => {
          setUserLocationNames([])
          setUserDistrictOptions([])
        })
    }

    fetchLocations()
    fetchUserLocations()
  }, [])

  const prioritizedLocationOptions = useMemo(() => {
    const locationMap = new Map(locations.map(location => [normalizeText(location.name), location]))
    const pickedKeys = new Set()
    const result = []

    const addProvinceByName = (name) => {
      const key = normalizeText(name)
      const item = locationMap.get(key)
      if (item && !pickedKeys.has(key)) {
        pickedKeys.add(key)
        result.push({
          label: item.name,
          value: item.name,
          type: 'province'
        })
      }
    }

    userLocationNames.forEach(addProvinceByName)
    userDistrictOptions.forEach(option => {
      if (result.length < 12) result.push(option)
    })
    POPULAR_LOCATIONS.forEach(addProvinceByName)

    if (result.length < 12) {
      sortByName(locations).forEach(location => {
        const key = normalizeText(location.name)
        if (result.length < 12 && !pickedKeys.has(key)) {
          pickedKeys.add(key)
          result.push({
            label: location.name,
            value: location.name,
            type: 'province'
          })
        }
      })
    }

    return result
  }, [locations, userDistrictOptions, userLocationNames])

  const searchedLocations = useMemo(() => {
    const keyword = normalizeText(locationSearch)
    const source = keyword
      ? locations.filter(location => normalizeText(location.name).includes(keyword))
      : locations

    return sortByName(source)
  }, [locations, locationSearch])

  const groupedLocations = useMemo(() => {
    return searchedLocations.reduce((groups, location) => {
      const firstLetter = getLocationSearchName(location.name).charAt(0).toUpperCase() || '#'
      if (!groups[firstLetter]) groups[firstLetter] = []
      groups[firstLetter].push(location)
      return groups
    }, {})
  }, [searchedLocations])

  const locationGroupKeys = useMemo(() => Object.keys(groupedLocations).sort((a, b) => a.localeCompare(b)), [groupedLocations])

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-100 p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <RiFilterLine size={18} className="text-orange-500" />
          BỘ LỌC TÌM KIẾM
        </h2>
      </div>

      <div className="py-4 border-b border-gray-200">
        <h2
          className="font-medium text-gray-800 mb-2 flex justify-between items-center w-full"
        >
          Nơi bán
        </h2>
        {userLocationNames.length > 0 && (
          <p className="mb-2 text-xs text-blue-500">Ưu tiên theo địa chỉ của bạn</p>
        )}
        <div className="mt-2 space-y-2 pr-2">
          {prioritizedLocationOptions.length > 0 && prioritizedLocationOptions.map((loc) => (
            <div 
              key={loc.id || `${loc.type}-${loc.label}`} 
              className="flex items-center"
            >
              <input
                type="checkbox"
                checked={loc.type === 'district'
                  ? checkedDistrictLabels.includes(loc.id)
                  : filters.locations?.includes(loc.value)}
                className="w-4 h-4 cursor-pointer rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                onChange={e => togglePriorityLocation(loc, e.target.checked)}
              />
              <label className="ml-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                {loc.label}
              </label>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-500"
          onClick={() => setIsLocationPickerOpen(true)}
        >
          <FiSearch size={15} />
          Khác
        </button>
      </div>

      <div className="py-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-800 mb-2 flex items-center">
          <RiPriceTag3Line size={16} className="mr-2 text-orange-500" />
          Khoảng Giá
        </h3>
        <div className="mt-4 px-2">
          <div className="flex gap-2 mt-4">
            <div className="flex-1">
              <input
                type="number"
                value={priceRange.min}
                onChange={(e) => setPriceRange(prev => ({ ...prev, min: parseInt(e.target.value) || '' }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                placeholder="₫ Từ"
              />
            </div>
            <div className="self-center">-</div>
            <div className="flex-1">
              <input
                type="number"
                value={priceRange.max}
                onChange={(e) => setPriceRange(prev => ({ ...prev, max: parseInt(e.target.value) || '' }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                placeholder="₫ Đến"
              />
            </div>
          </div>
          {errorPriceRange && (
            <p className='text-red-500 text-sm'>Vui lòng chọn khoảng giá phù hợp</p>
          )}
          <button 
            className="cursor-pointer w-full mt-3 px-3 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
            onClick={handlePriceChange}  
          >
            Áp Dụng
          </button>
        </div>
      </div>

      <div className="py-4 border-b border-gray-200">
        <h2
          className="font-medium text-gray-800 mb-2 flex justify-between items-center w-full"
        >
          Đánh giá
        </h2>

        <div className="mt-4 px-2 flex flex-col gap-2">
          {[5, 4, 3, 2, 1].map(rating => (
            <div 
              key={rating} 
              className="cursor-pointer flex gap-3 items-center justify-left"
              onClick={() => {
                setFilters(prev => ({
                  ...prev, 
                  minRating: rating
                }))
              }}
            >
              {[...Array(5)].map((_, index) => (
                <FaStar
                  key={index}
                  className={index < rating ? "text-blue-500" : "text-gray-300"}
                />
              ))}
              {rating <= 4 && <p>trở lên</p>}
            </div>
          ))}
        </div>
      </div> 

      <button 
        className="cursor-pointer w-full mt-3 px-3 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
        onClick={() => {
          setPriceRange({
            max: '',
            min: ''
          })
          setCheckedDistrictLabels([])
          resetFilters()
        }}  
      >
        Xóa bộ lọc
      </button>

      {isLocationPickerOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 px-3 py-5">
          <div className="flex h-[min(720px,86vh)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="relative flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center">
              <h3 className="shrink-0 text-base font-medium text-gray-800">Tỉnh / Thành phố</h3>
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  value={locationSearch}
                  onChange={e => setLocationSearch(e.target.value)}
                  placeholder="Bạn muốn mua hàng từ Tỉnh / Thành phố nào?"
                  className="h-10 w-full border border-gray-300 bg-white pl-3 pr-10 text-sm text-gray-700 outline-none focus:border-blue-400"
                  autoFocus
                />
                <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>
              <button
                type="button"
                aria-label="Đóng"
                className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 sm:static"
                onClick={() => setIsLocationPickerOpen(false)}
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {locationGroupKeys.length > 0 ? (
                locationGroupKeys.map(groupKey => (
                  <div key={groupKey} id={`location-group-${groupKey}`} className="mb-4">
                    <h4 className="mb-2 text-sm font-medium text-gray-700">{groupKey}</h4>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                      {groupedLocations[groupKey].map(location => (
                        <label key={location.id || location.name} className="flex min-w-0 cursor-pointer items-center text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={filters.locations?.includes(location.name)}
                            className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                            onChange={e => toggleLocation(location.name, e.target.checked)}
                          />
                          <span className="ml-2 min-w-0 truncate">{location.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-gray-500">Không tìm thấy địa điểm phù hợp</p>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 bg-white p-4">
              <button
                type="button"
                className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                onClick={() => {
                  setFilters(prev => ({ ...prev, locations: [] }))
                  setCheckedDistrictLabels([])
                  setLocationSearch('')
                }}
              >
                Thiết lập lại
              </button>
              <button
                type="button"
                className="rounded-md bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600"
                onClick={() => setIsLocationPickerOpen(false)}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
