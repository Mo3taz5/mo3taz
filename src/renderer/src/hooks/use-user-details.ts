import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "./redux";
import {
  setProfileBackground,
  setUserDetails,
  setFriendRequests,
  clearCollections,
} from "@renderer/features";
import type {
  FriendRequestAction,
  UpdateProfileRequest,
  UserDetails,
  FriendRequest,
} from "@types";

export function useUserDetails() {
  const dispatch = useAppDispatch();

  const { userDetails, profileBackground, friendRequests, friendRequestCount } =
    useAppSelector((state) => state.userDetails);

  const clearUserDetails = useCallback(async () => {
    dispatch(setUserDetails(null));
    dispatch(setProfileBackground(null));
    dispatch(clearCollections());

    window.localStorage.removeItem("userDetails");
  }, [dispatch]);

  const signOut = useCallback(async () => {
    clearUserDetails();

    return window.electron.signOut();
  }, [clearUserDetails]);

  const updateUserDetails = useCallback(
    async (userDetails: UserDetails) => {
      dispatch(setUserDetails(userDetails));
      window.localStorage.setItem("userDetails", JSON.stringify(userDetails));
    },
    [dispatch]
  );

  const fetchUserDetails = useCallback(async () => {
    return window.electron.getMe().then((nextUserDetails) => {
      if (nextUserDetails == null) {
        clearUserDetails();
        return null;
      }

      updateUserDetails(nextUserDetails);
      window["userDetails"] = nextUserDetails;

      return nextUserDetails;
    });
  }, [clearUserDetails, updateUserDetails]);

  const patchUser = useCallback(
    async (values: UpdateProfileRequest) => {
      const response = await window.electron.updateProfile(values);
      return updateUserDetails({
        ...(userDetails ?? {}),
        ...response,
        username: userDetails?.username || "",
        subscription: userDetails?.subscription ?? null,
        workwondersJwt: userDetails?.workwondersJwt || "",
        karma: response.karma ?? userDetails?.karma ?? 0,
      });
    },
    [
      updateUserDetails,
      userDetails,
      userDetails?.username,
      userDetails?.subscription,
      userDetails?.workwondersJwt,
      userDetails?.karma,
    ]
  );

  const fetchFriendRequests = useCallback(async () => {
    return window.electron.hydraApi
      .get<FriendRequest[]>("/profile/friend-requests", {
        needsAuth: true,
      })
      .then((friendRequests) => {
        dispatch(setFriendRequests(friendRequests));
      })
      .catch(() => {});
  }, [dispatch]);

  const sendFriendRequest = useCallback(
    async (userId: string) => {
      return window.electron.hydraApi
        .post("/profile/friend-requests", {
          data: { friendCode: userId },
          needsAuth: true,
        })
        .then(() => fetchFriendRequests());
    },
    [fetchFriendRequests]
  );

  const updateFriendRequestState = useCallback(
    async (userId: string, action: FriendRequestAction) => {
      if (action === "CANCEL") {
        return window.electron.hydraApi
          .delete(`/profile/friend-requests/${userId}`, {
            needsAuth: true,
          })
          .then(() => fetchFriendRequests());
      }

      return window.electron.hydraApi
        .patch(`/profile/friend-requests/${userId}`, {
          data: {
            requestState: action,
          },
          needsAuth: true,
        })
        .then(() => fetchFriendRequests());
    },
    [fetchFriendRequests]
  );

  const undoFriendship = (userId: string) =>
    window.electron.hydraApi.delete(`/profile/friend-requests/${userId}`, {
      needsAuth: true,
    });

  const blockUser = (userId: string) =>
    window.electron.hydraApi.post(`/users/${userId}/block`, {
      needsAuth: true,
    });

  const unblockUser = (userId: string) =>
    window.electron.hydraApi.post(`/users/${userId}/unblock`, {
      needsAuth: true,
    });

  const hasActiveSubscription = useMemo(() => {
    const expiresAt = new Date(userDetails?.subscription?.expiresAt ?? 0);
    return expiresAt > new Date();
  }, [userDetails]);

  return {
    userDetails,
    profileBackground,
    friendRequests,
    friendRequestCount,
    hasActiveSubscription,
    fetchUserDetails,
    signOut,
    clearUserDetails,
    updateUserDetails,
    patchUser,
    sendFriendRequest,
    fetchFriendRequests,
    updateFriendRequestState,
    blockUser,
    unblockUser,
    undoFriendship,
  };
}
