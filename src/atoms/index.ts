import { atom } from "jotai";

interface UserInfo {
    uid: number;
    nickname: string;
}

interface AuthData {
    token: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    };
    user: UserInfo;
}

export const editorTextAtom = atom("");
export const fileUrlAtom = atom("");

export const authDataAtom = atom<AuthData | null>(null);
export const avatarAtom = atom<string | null>(null);

export const isSidebarCollapsedAtom = atom(false);
