import { createSlice } from "@reduxjs/toolkit";

const chatSlice = createSlice({
    name: "chat",
    initialState: {
        userId: null,  // ID của user đang chat
        chatOpen: false,  // Trạng thái mở chat panel
    },
    reducers: {
        setUserId: (state, action) => {
            state.userId = action.payload; // Cập nhật userId khi nhấn vào chat
        },
        setChatOpen: (state, action) => {
            state.chatOpen = action.payload; // Cập nhật trạng thái mở chat
        }
    }
});

export const { setUserId, setChatOpen } = chatSlice.actions;
export default chatSlice.reducer;
