import { MAX_IMAGE_SIZE, UPLOAD_API_URL } from "../constants";
import { fetchWithAuth } from "./AuthUtil";

const getErrorMessage = async (res) => {
    try {
        const data = await res.json();
        return data.detail || data.message || "Upload failed";
    } catch {
        return "Upload failed";
    }
};

export async function uploadImage(file) {
    if (!file) return null;
    if (!file.type?.startsWith("image/")) {
        throw new Error("File's type is invalid");
    }
    if (file.size > MAX_IMAGE_SIZE) {
        throw new Error(`File's size is too large (> ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB)`);
    }

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetchWithAuth(`${UPLOAD_API_URL}/image`, window.location, true, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        throw new Error(await getErrorMessage(res));
    }

    const data = await res.json();
    if (!data.url) {
        throw new Error("Upload service did not return image URL");
    }
    return data.url;
}

export async function uploadImages(files) {
    const urls = [];
    for (const file of Array.from(files || [])) {
        const url = await uploadImage(file);
        if (url) urls.push(url);
    }
    return urls;
}
