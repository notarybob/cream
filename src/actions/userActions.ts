import { auth, firestore, storage } from 'firebase';
import { ThunkAction, ThunkDispatch } from "redux-thunk";
import { DEFAULT_PHOTO_URI } from '../constants';
import { navigate } from "../navigations/rootNavigation";
import { defaultUserState, ErrorAction, ExtraInfoPayload, NotificationProperties, NotificationSetting, PostStoryCommentOptions, PrivacyCommentOptions, PrivacyProperties, PrivacySetting, SuccessAction, userAction, userActionTypes, UserInfo, userPayload, UserSetting, HashTag, SearchItem, BookmarkCollection, Bookmark, StoryArchive, PostArchive, Highlight } from '../reducers/userReducer';
import { WelcomePropsRouteParams } from '../screens/Auth/Welcome';
import { store } from '../store';
import { generateUsernameKeywords, uriToBlob, Timestamp } from '../utils';
import { Alert } from 'react-native';
import { CreateNotificationRequest } from './notificationActions';
import { notificationTypes } from '../reducers/notificationReducer';
import { ProfileX } from '../reducers/profileXReducer';
export interface userLoginWithEmail {
    email: string,
    password: string
}
export type RegisterParams = WelcomePropsRouteParams & { username: string }
export var LoginRequest = (user: userLoginWithEmail):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        return auth().signInWithEmailAndPassword(user.email, user.password).then(rs => {
            if (rs.user) {
                let userx = rs.user
                firestore().collection('users')
                    .where('email', '==', user.email).get().then(rq => {
                        if (rq.size > 0) {
                            setTimeout(() => {
                                navigate('HomeTab')
                            }, 300);
                            var {
                                avatarURL,
                                bio,
                                birthday,
                                email,
                                followings,
                                fullname,
                                gender,
                                phone,
                                searchRecent,
                                username,
                                website,
                                requestedList,
                                notificationSetting,
                                privacySetting,
                                postNotificationList,
                                storyNotificationList,
                                unSuggestList
                            } = rq.docs[0].data()
                            var result: userPayload = {
                                user: {
                                    logined: true,
                                    firebaseUser: userx,
                                    userInfo: {
                                        avatarURL,
                                        bio,
                                        birthday,
                                        email,
                                        followings,
                                        fullname,
                                        gender,
                                        phone,
                                        searchRecent: searchRecent || [],
                                        username,
                                        website,
                                        storyNotificationList,
                                        postNotificationList,
                                        requestedList,
                                        unSuggestList
                                    }
                                },
                                setting: {
                                    notification: notificationSetting || defaultUserState.setting?.notification,
                                    privacy: privacySetting || defaultUserState.setting?.privacy
                                }
                            }
                            dispatch(LoginSuccess(result))
                        } else dispatch(LoginFailure())
                    })
            } else dispatch(LoginFailure())
        }).catch(e => {
            dispatch(LoginFailure())
        })
    }
}
export var LoginFailure = (): ErrorAction => {
    return {
        type: userActionTypes.LOGIN_FAILURE,
        payload: {
            message: 'Login Failed!'
        }
    }
}
export var LoginSuccess = (payload: userPayload): SuccessAction<userPayload> => {
    return {
        type: userActionTypes.LOGIN_SUCCESS,
        payload: payload
    }
}
export var LogoutRequest = ():
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            dispatch({
                type: userActionTypes.LOGOUT_SUCCESS,
                payload: {}
            })
        } catch (e) {
            dispatch({
                type: userActionTypes.LOGOUT_FAILURE,
                payload: {
                    message: 'Can not logout now!'
                }
            })
        }
    }
}
export var RegisterRequest = (userData: RegisterParams):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        return auth()
            .createUserWithEmailAndPassword(userData.email, userData.password)
            .then(rs => {
                rs.user?.sendEmailVerification()
                firestore().collection('users').doc(userData.username)
                    .set({
                        email: userData.email,
                        fullname: userData.fullname,
                        keyword: generateUsernameKeywords(userData.username),
                        phone: userData.phone,
                        username: userData.username,
                        birthday: {
                            date: userData.date,
                            month: userData.month,
                            year: userData.year
                        },
                        bio: '',
                        gender: 2,
                        followings: [userData.username],
                        requestedList: [],
                        searchRecent: [],
                        storyNotificationList: [],
                        postNotificationList: [],
                        website: '',
                        avatarURL: DEFAULT_PHOTO_URI,
                        privacySetting: {
                            ...defaultUserState.setting?.privacy
                        },
                        notificationSetting: {
                            ...defaultUserState.setting?.notification
                        }
                    })
                dispatch(LoginRequest({
                    email: userData.email,
                    password: userData.password,
                }))
            }).catch(e => {
                dispatch(RegisterFailure(`${e}`))
            })
    }
}
export var RegisterFailure = (e: string): ErrorAction => {
    return {
        payload: {
            message: e
        },
        type: userActionTypes.REGISTER_FAILURE
    }
}
export var UnfollowRequest = (username: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            let me: UserInfo = { ...store.getState().user.user.userInfo }
            var ref = firestore()
            var rq = await ref.collection('users')
                .where('username', '==', me.username).get()
            if (rq.size > 0) {
                var targetUser = rq.docs[0]
                var user: UserInfo = targetUser.data() || {}
                if (user.followings !== undefined &&
                    user.followings.indexOf(username) > -1) {
                    var followings = [...user.followings]
                    followings.splice(followings.indexOf(username), 1)
                    await targetUser.ref.update({
                        followings
                    })
                    dispatch(CreateNotificationRequest({
                        isUndo: true,
                        postId: 0,
                        replyId: 0,
                        commentId: 0,
                        userId: [username],
                        from: me.username,
                        create_at: Timestamp(),
                        type: notificationTypes.FOLLOW_ME
                    }))
                }
                var rq2 = await targetUser.ref.get()
                me = rq2.data() || {}
                dispatch(UnfollowSuccess(me))
            } else {

            }
        } catch (e) {
            console.warn(e)
            dispatch(UnfollowFailure())
        }
    }
}
export var UnfollowFailure = (): ErrorAction => {
    return {
        type: userActionTypes.UNFOLLOW_FAILURE,
        payload: {
            message: `Can't unfollow this people!`
        }
    }
}
export var UnfollowSuccess = (user: UserInfo): SuccessAction<UserInfo> => {
    return {
        type: userActionTypes.UNFOLLOW_SUCCESS,
        payload: user
    }
}
/**
 * FETCH EXTRA INFO ACTION
 */
export var FetchExtraInfoRequest = ():
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            let me: UserInfo = { ...store.getState().user.user.userInfo }
            var ref = firestore()
            var rq = await ref.collection('posts')
                .where('userId', '==', me.username)
                .orderBy('create_at', 'desc')
                .get()
            var tagPhotos = await ref.collection('posts')
                .where('tagUsername', 'array-contains', me.username)
                .orderBy('create_at', 'desc')
                .get()
            var payload: ExtraInfoPayload = {
                currentStory: [],
                extraInfo: {
                    unSuggestList: [],
                    requestedList: [],
                    followers: [],
                    followings: [],
                    posts: rq.size || 0
                },
                photos: rq.docs.map(x => x.data()),
                tagPhotos: tagPhotos.docs.map(x => x.data()),
            }
            var rq2 = await ref.collection('users')
                .where('username', '==', me.username).limit(1).get()
            if (rq2.size > 0) {
                payload.extraInfo.followings = rq2.docs[0].data().followings || []
                payload.extraInfo.unSuggestList = rq2.docs[0].data().unSuggestList || []
                payload.extraInfo.requestedList = rq2.docs[0].data().requestedList || []
                var rq3 = await ref.collection('users')
                    .where('followings', 'array-contains', me.username).get()
                payload.extraInfo.followers = rq3.docs.map(x => x.data().username)
                var rq5 = await ref.collection('stories')
                    .where('userId', '==', me.username)
                    .where('create_at', '>=',
                        new Date(new Date().getTime() - 24 * 3600 * 1000))
                    .orderBy('create_at', 'asc').get()
                payload.currentStory = rq5.docs.map(x => x.data())
                dispatch(FetchExtraInfoSuccess(payload))

            } else dispatch(FetchExtraInfoFailure())
        } catch (e) {
            console.warn(e)
            dispatch(FetchExtraInfoFailure())
        }
    }
}
export var FetchExtraInfoFailure = (): ErrorAction => {
    return {
        type: userActionTypes.FETCH_EXTRA_INFO_FAILURE,
        payload: {
            message: `Can't get information`
        }
    }
}
export var FetchExtraInfoSuccess = (extraInfo: ExtraInfoPayload):
    SuccessAction<ExtraInfoPayload> => {
    return {
        type: userActionTypes.FETCH_EXTRA_INFO_SUCCESS,
        payload: extraInfo
    }
}
//update extra info
export var UpdateExtraInfoRequest = (data: ExtraInfoPayload):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            dispatch(FetchExtraInfoSuccess(data))
        } catch (e) {
            console.warn(e)
            dispatch(FetchExtraInfoFailure())
        }
    }
}
//
export var FollowContactsRequest = (phoneList: string[]):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            let me: UserInfo = { ...store.getState().user.user.userInfo }
            var ref = firestore()
            var rq = await ref.collection('users')
                .where('username', '==', me.username).get()
            if (rq.size > 0) {
                var targetUser = rq.docs[0]
                let userList: string[] = []
                phoneList.map(async (phone, index) => {
                    var rq2 = await ref.collection('users')
                        .where('phone', '==', phone).get()
                    if (rq2.docs.length > 0) {
                        var user = rq2.docs[0].data()
                        if (user.username) {
                            userList.push(user.username)
                        }
                    }
                    if (index === phoneList.length - 1) {
                        userList.map(async (username, index2) => {
                            var user: UserInfo = targetUser.data() || {}
                            if (user.followings !== undefined &&
                                user.followings.indexOf(username) < 0 &&
                                username !== me.username) {
                                user.followings
                                    .push(username)
                                var followings = [...user.followings]
                                await targetUser.ref.update({
                                    followings
                                })
                            }
                            if (index2 === userList.length - 1) {
                                var rq2 = await targetUser.ref.get()
                                me = rq2.data() || {}
                                dispatch(FollowUserSuccess(me))
                            }
                        })

                    }
                })
            } else {
                dispatch(FollowUserFailure())
            }

        } catch (e) {
            console.warn(e)
            dispatch(FollowUserFailure())
        }
    }
}
export var ToggleFollowUserRequest = (username: string, refreshExtraInfo: boolean = false):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            let me: UserInfo = { ...store.getState().user.user.userInfo }
            var ref = firestore()
            var rq = await ref.collection('users')
                .where('username', '==', me.username).get()
            var targetUser = await ref.collection('users').doc(username).get()
            if (rq.size > 0) {
                var myUser = rq.docs[0]
                var userData: UserInfo = myUser.data() || {}
                var currentFollowings = userData.followings || []
                var index = currentFollowings.indexOf(username)
                var targetUserData: {
                    privacySetting?: {
                        accountPrivacy: {
                            private: boolean
                        }
                    }
                } = targetUser.data() || {}
                if (index < 0) {
                    if (targetUserData.privacySetting?.accountPrivacy.private) {
                        dispatch(ToggleSendFollowRequest(username))
                    } else currentFollowings.push(username)
                } else {
                    currentFollowings.splice(index, 1)
                }
                myUser.ref.update({
                    followings: currentFollowings
                })

                //add notification
                if (index < 0 && !!!targetUserData.privacySetting?.accountPrivacy.private) {
                    dispatch(CreateNotificationRequest({
                        postId: 0,
                        replyId: 0,
                        commentId: 0,
                        userId: [username],
                        from: me.username,
                        create_at: Timestamp(),
                        type: notificationTypes.FOLLOW_ME
                    }))
                } else if (index > -1 && !!!targetUserData.privacySetting?.accountPrivacy.private) {
                    dispatch(CreateNotificationRequest({
                        isUndo: true,
                        postId: 0,
                        replyId: 0,
                        commentId: 0,
                        userId: [username],
                        from: me.username,
                        create_at: Timestamp(),
                        type: notificationTypes.FOLLOW_ME
                    }))
                }

                dispatch(FollowUserSuccess(userData))
                if (refreshExtraInfo) {
                    dispatch(FetchExtraInfoRequest())
                }
            } else {
                dispatch(FollowUserFailure())
            }
        } catch (e) {
            console.warn(e)
            dispatch(FollowUserFailure())
        }
    }
}
export var FollowUserSuccess = (payload: UserInfo):
    SuccessAction<UserInfo> => {
    return {
        type: userActionTypes.FOLLOW_SUCCESS,
        payload,
    }
}
export var FollowUserFailure = ():
    ErrorAction => {
    return {
        type: userActionTypes.FOLLOW_FAILURE,
        payload: {
            message: `Error! Can't send following request`
        }
    }
}
//SEND FOLLOW REQUEST
export var ToggleSendFollowRequest = (username: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            let me: UserInfo = { ...store.getState().user.user.userInfo }
            var ref = firestore()
            var rq = await ref.collection('users')
                .where('username', '==', me.username).get()
            if (rq.size > 0) {
                var targetUser = await ref.collection('users').doc(username).get()
                var targetUserData = targetUser.data() || {}
                var requestedList = targetUserData.requestedList || []
                var index = requestedList.indexOf(me.username)
                if (index < 0) {
                    requestedList.push(me.username)
                } else {
                    requestedList.splice(index, 1)
                }
                targetUser.ref.update({
                    requestedList
                })
            } else {
                dispatch(FollowUserFailure())
            }
        } catch (e) {
            console.warn(e)
            dispatch(FollowUserFailure())
        }
    }
}
//UPDATE USER INFO ACTIONS 
export var UpdateUserInfoRequest = (updateUserData: UserInfo):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            let me: UserInfo = { ...store.getState().user.user.userInfo }
            var ref = firestore()
            var rq = await ref.collection('users')
                .where('username', '==', me.username).get()
            if (rq.size > 0) {
                var userData: UserInfo = rq.docs[0].data()
                var userRef = rq.docs[0].ref
                var userInfo = {
                    ...userData,
                    ...updateUserData
                }
                var { email,
                    avatarURL,
                    bio,
                    birthday,
                    followings,
                    fullname,
                    gender,
                    phone,
                    username,
                    website
                } = userInfo
                var filterdUserInfo: UserInfo = {
                    email,
                    avatarURL,
                    bio,
                    birthday,
                    followings,
                    fullname,
                    gender,
                    phone,
                    username,
                    website
                }
                if (userInfo.username !== me.username) {
                    ref.collection('users')
                        .doc(userInfo.username)
                        .set(userInfo)
                    ref.collection('users').doc(me.username).delete()
                } else userRef.update(userInfo)

                dispatch(UpdateUserInfoSuccess(filterdUserInfo))
            } else {
                dispatch(UpdateUserInfoFailure())
            }

        } catch (e) {
            console.warn(e)
            dispatch(UpdateUserInfoFailure())
        }
    }
}
export var UpdateUserInfoFailure = (): ErrorAction => {
    return {
        type: userActionTypes.UPDATE_USER_INFO_FAILURE,
        payload: {
            message: `Can't update now, try again!`
        }
    }
}
export var UpdateUserInfoSuccess = (user: UserInfo): SuccessAction<UserInfo> => {
    return {
        type: userActionTypes.UPDATE_USER_INFO_SUCCESS,
        payload: user
    }
}
//UPDATE NOTIFICATION ACTIONS
export var UpdateNotificationSettingsRequest = (setting: NotificationSetting):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            if (Object.keys(setting).length === 0) throw new Error;
            var targetSetting = Object.keys(setting)[0]
            let me: UserInfo = { ...store.getState().user.user.userInfo }
            var ref = firestore()
            var rq = await ref.collection('users').doc(me.username).get()
            var targetUser = rq.ref
            type TempIntersection = UserInfo & { notificationSetting?: NotificationSetting }

            var user: TempIntersection = rq.data() || {}
            if (user.notificationSetting) {
                for (let [key, value] of Object.entries(user.notificationSetting)) {
                    if (setting.hasOwnProperty(key)) {
                        value = <PostStoryCommentOptions>value
                        setting[<NotificationProperties>key] = {
                            ...value,
                            ...Object.values(setting)[0]
                        }
                        break;
                    }
                }
            }
            await targetUser.update({
                notificationSetting: {
                    ...(user.notificationSetting || {}),
                    ...setting
                }
            })
            var rq2 = await targetUser.get()
            var result: TempIntersection = rq.data() || {}
            dispatch(UpdateNotificationSettingSuccess({
                ...(user.notificationSetting || {}),
                ...setting
            }))
        } catch (e) {
            dispatch(UpdateNotificationSettingFailure())
        }
    }
}
export var UpdateNotificationSettingSuccess = (payload: NotificationSetting):
    SuccessAction<NotificationSetting> => {
    return {
        type: userActionTypes.UPDATE_NOTIFICATION_SETTING_SUCCESS,
        payload,
    }
}
export var UpdateNotificationSettingFailure = ():
    ErrorAction => {
    return {
        type: userActionTypes.UPDATE_NOTIFICATION_SETTING_FAILURE,
        payload: {
            message: `Error! Can't update setting`
        }
    }
}
//UPDATE PRIVACY SETTING ACTIONS
export var UpdatePrivacySettingsRequest = (setting: PrivacySetting):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            if (Object.keys(setting).length === 0) throw new Error;
            var targetSetting = Object.keys(setting)[0]
            let me: UserInfo = { ...store.getState().user.user.userInfo }
            var ref = firestore()
            var rq = await ref.collection('users').doc(me.username).get()
            var targetUser = rq.ref
            type TempIntersection = UserInfo & { privacySetting?: PrivacySetting }

            var user: TempIntersection = rq.data() || {}
            if (user.privacySetting) {
                for (let [key, value] of Object.entries(user.privacySetting)) {
                    if (setting.hasOwnProperty(key)) {
                        value = <PrivacyCommentOptions>value
                        setting[<PrivacyProperties>key] = {
                            ...value,
                            ...Object.values(setting)[0]
                        }
                        break;
                    }
                }
            }
            await targetUser.update({
                privacySetting: {
                    ...(user.privacySetting || {}),
                    ...setting
                }
            })
            var rq2 = await targetUser.get()
            var result: TempIntersection = rq.data() || {}
            dispatch(UpdatePrivacySettingSuccess({
                ...(user.privacySetting || {}),
                ...setting
            }))
        } catch (e) {
            console.warn(e)
            dispatch(UpdatePrivacySettingFailure())
        }
    }
}
export var UpdatePrivacySettingSuccess = (payload: PrivacySetting):
    SuccessAction<PrivacySetting> => {
    return {
        type: userActionTypes.UPDATE_PRIVACY_SETTING_SUCCESS,
        payload,
    }
}
export var UpdatePrivacySettingFailure = ():
    ErrorAction => {
    return {
        type: userActionTypes.UPDATE_PRIVACY_SETTING_FAILURE,
        payload: {
            message: `Error! Can't update setting`
        }
    }
}
export var UploadAvatarRequest = (uri: string, extension: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var me = store.getState().user.user.userInfo
            var blob = await uriToBlob(uri)
            var result = await storage().ref()
                .child(`avatar/${me?.username}.${extension}`)
                .put(blob as Blob, {
                    contentType: `image/${extension}`
                })
            var downloadUri = await result.ref.getDownloadURL()
            dispatch(UpdateUserInfoRequest({
                avatarURL: downloadUri
            }))
        } catch (e) {

        }
    }
}
export var RemoveFollowerRequest = (username: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var me = store.getState().user.user.userInfo
            var ref = firestore()
            var myUsername = me?.username || ""
            var rq = await ref.collection('users')
                .doc(username).get()
            var targetUser: UserInfo = rq.data() || {}
            var targetFollowings = targetUser.followings || []
            var index = targetFollowings.indexOf(myUsername)
            if (index > -1) {
                targetFollowings.splice(index, 1)
                rq.ref.update({
                    followings: [...targetFollowings]
                })
                dispatch(FetchExtraInfoRequest())
            }
        } catch (e) {

        }
    }
}
//FETCH SETTING ACTION
export var FetchSettingRequest = ():
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        var me = store.getState().user.user.userInfo
        var rq = await firestore().collection('users')
            .doc(me?.username).get()
        if (rq.exists) {
            var {
                notificationSetting,
                privacySetting,
            } = rq.data() || {}
            var result: UserSetting = {
                notification: notificationSetting || defaultUserState.setting?.notification,
                privacy: privacySetting || defaultUserState.setting?.privacy
            }
            dispatch(FetchSettingSuccess(result))
        } else dispatch(FetchSettingFailure())
    }
}
export var FetchSettingFailure = (): ErrorAction => {
    return {
        type: userActionTypes.FETCH_SETTING_FAILURE,
        payload: {
            message: 'FetchSetting Failed!'
        }
    }
}
export var FetchSettingSuccess = (payload: UserSetting): SuccessAction<UserSetting> => {
    return {
        type: userActionTypes.FETCH_SETTING_SUCCESS,
        payload: payload
    }
}
//CONFIRM REQUEST ACTION
export var ConfirmFollowRequest = (username: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        var me = store.getState().user.user.userInfo
        var ref = firestore()
        var rq = await ref.collection('users')
            .doc(me?.username).get()
        var targetUser = await ref.collection('users').doc(username).get()
        if (rq.exists && targetUser.exists) {
            var targetUserData: UserInfo = targetUser.data() || {}
            var currentTargetUserFollowings = targetUserData.followings || []
            if (currentTargetUserFollowings.indexOf(me?.username || '') < 0) {
                currentTargetUserFollowings.push(me?.username || '')
                targetUser.ref.update({
                    followings: currentTargetUserFollowings
                })
            }
            var myUserData: UserInfo = rq.data() || {}
            var currentRequest = myUserData.requestedList || []
            var index = currentRequest.indexOf(username)
            if (index > -1) {
                currentRequest.splice(index, 1)
                rq.ref.update({
                    requestedList: currentRequest
                })
            }
            dispatch(FetchExtraInfoRequest())
        } else {
            Alert.alert('Error', 'Please check your network!')
        }
    }
}
export var DeclineFollowRequest = (username: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        var me = store.getState().user.user.userInfo
        var ref = firestore()
        var rq = await ref.collection('users')
            .doc(me?.username).get()
        var targetUser = await ref.collection('users').doc(username).get()
        if (rq.exists && targetUser.exists) {
            var targetUserData: UserInfo = targetUser.data() || {}
            var currentTargetUserFollowings = targetUserData.followings || []
            var index = currentTargetUserFollowings.indexOf(me?.username || '')
            if (index > -1) {
                currentTargetUserFollowings.splice(index, 1)
                targetUser.ref.update({
                    followings: currentTargetUserFollowings
                })
            }
            var myUserData: UserInfo = rq.data() || {}
            var currentRequest = myUserData.requestedList || []
            var index2 = currentRequest.indexOf(username)
            if (index2 > -1) {
                currentRequest.splice(index2, 1)
                rq.ref.update({
                    requestedList: currentRequest
                })
            }
            dispatch(FetchExtraInfoRequest())
        } else {
            Alert.alert('Error', 'Please check your network!')
        }
    }
}
//ADD UNSUGGESTION LIST 
export var UnSuggestionRequest = (username: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        var me = store.getState().user.user.userInfo
        var ref = firestore()
        var rq = await ref.collection('users')
            .doc(me?.username).get()
        if (rq.exists) {
            var myUserData: UserInfo = rq.data() || {}
            var currentUnSuggestList = myUserData.unSuggestList || []
            var index = currentUnSuggestList.indexOf(username)
            if (index < 0) {
                currentUnSuggestList.push(username)
                rq.ref.update({
                    unSuggestList: currentUnSuggestList
                })
            }
            dispatch(FetchExtraInfoRequest())
        } else {
            Alert.alert('Error', 'Please check your network!')
        }
    }
}
// change search recent list
export var FetchRecentSearchRequest = ():
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, SuccessAction<SearchItem[]>>) => {
        var me = store.getState().user.user.userInfo
        var ref = firestore()
        var rq = await ref.collection('users')
            .doc(me?.username).get()
        if (rq.exists) {
            var myUserData: UserInfo = rq.data() || {}
            var recentSearchList: SearchItem[] = myUserData.searchRecent || []
            dispatch({
                type: userActionTypes.FETCH_RECENT_SEARCH_SUCCESS,
                payload: recentSearchList
            })
        } else {
            Alert.alert('Error', 'Please check your network!')
        }
    }
}
export var PushRecentSearchRequest = (searchItem: SearchItem):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        var me = store.getState().user.user.userInfo
        var ref = firestore()
        var rq = await ref.collection('users')
            .doc(me?.username).get()
        if (rq.exists) {
            var myUserData: UserInfo = rq.data() || {}
            var recentSearchList: SearchItem[] = myUserData.searchRecent || []
            var temp = [...recentSearchList]
            var check = temp.every((item, index) => {
                if ((item.username === searchItem.username && searchItem.type === 1
                    && item.type === 1)
                    || (item.hashtag === searchItem.hashtag && searchItem.type === 2
                        && item.type === 2)
                    || (item.address === searchItem.address && searchItem.type === 3
                        && item.type === 3)
                ) {
                    recentSearchList.splice(index, 1)
                    recentSearchList.push(searchItem)
                    return false
                }
                return true
            })
            if (check) {
                recentSearchList.push(searchItem)
            }
            rq.ref.update({
                searchRecent: recentSearchList
            })
            dispatch(FetchRecentSearchRequest())
        } else {
            Alert.alert('Error', 'Please check your network!')
        }
    }
}
export var RemoveRecentSearchRequest = (searchItem: SearchItem):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        var me = store.getState().user.user.userInfo
        var ref = firestore()
        var rq = await ref.collection('users')
            .doc(me?.username).get()
        if (rq.exists) {
            var myUserData: UserInfo = rq.data() || {}
            var recentSearchList: SearchItem[] = myUserData.searchRecent || []
            var temp = [...recentSearchList]
            temp.every((item, index) => {
                if ((item.username === searchItem.username && searchItem.type === 1
                    && item.type === 1)
                    || (item.hashtag === searchItem.hashtag && searchItem.type === 2
                        && item.type === 2)
                    || (item.address === searchItem.address && searchItem.type === 3
                        && item.type === 3)
                ) {
                    recentSearchList.splice(index, 1)
                    return false
                }
                return true
            })
            rq.ref.update({
                searchRecent: recentSearchList
            })
            dispatch(FetchRecentSearchRequest())
        } else {
            Alert.alert('Error', 'Please check your network!')
        }
    }
}
export var ToggleBookMarkRequest = (postId: number, previewUri: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var collections = [...(store.getState().user.bookmarks || [])]
            if (collections.length > 0) {
                var newCollections = collections.map((collection, index) => {
                    var bookmarks = [...collection.bookmarks]
                    var index2 = bookmarks.findIndex(x => x.postId === postId)
                    if (index2 > -1) {
                        bookmarks.splice(index2, 1)
                        if (collection.avatarIndex === index2
                            && collection.bookmarks.length > 0
                        ) {
                            collection.avatarIndex = 0
                        }
                    } else {
                        if (collection.name === 'All Posts') {
                            bookmarks.push({
                                postId,
                                previewUri,
                                create_at: new Date().getTime()
                            })
                        }
                    }
                    return {
                        ...collection,
                        bookmarks
                    }
                }).filter(x => x.bookmarks.length > 0)
                dispatch({
                    type: userActionTypes.UPDATE_BOOKMARK_SUCCESS,
                    payload: {
                        bookmarks: newCollections
                    }
                })
            } else {
                dispatch({
                    type: userActionTypes.UPDATE_BOOKMARK_SUCCESS,
                    payload: {
                        bookmarks: [{
                            bookmarks: [{
                                create_at: new Date().getTime(),
                                postId,
                                previewUri,
                            }],
                            name: 'All Posts',
                            create_at: new Date().getTime(),
                        }]
                    }
                })
            }
        }
        catch (e) {
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_FAILURE,
                payload: {
                    message: `Can't not edit bookmark now!`
                }
            })
        }
    }
}
export var CreateBookmarkCollectionRequest = (collection: BookmarkCollection):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var collections = [...(store.getState().user.bookmarks || [])]
            var index = collections.findIndex(x => x.name === collection.name)
            if (index > -1) {
                dispatch({
                    type: userActionTypes.UPDATE_BOOKMARK_FAILURE,
                    payload: {
                        message: 'Collection exists, choose another name!'
                    }
                })
                return;
            }
            collections.push(collection)
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_SUCCESS,
                payload: {
                    bookmarks: collections
                }
            })
        }
        catch (e) {
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_FAILURE,
                payload: {
                    message: `Can't not add collection now!`
                }
            })
        }
    }
}
export var RemoveBookmarkCollectionRequest = (collectionName: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var collections = [...(store.getState().user.bookmarks || [])]
                .filter(x => x.name !== collectionName)
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_SUCCESS,
                payload: {
                    bookmarks: collections
                }
            })
        }
        catch (e) {
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_FAILURE,
                payload: {
                    message: `Can't not add collection now!`
                }
            })
        }
    }
}
export var RemoveFromBookmarkCollectionRequest = (postId: number, collectionName: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            let collections = [...(store.getState().user.bookmarks || [])]
            if (collectionName !== 'All Posts') {
                var index = collections.findIndex(x => x.name === collectionName)
                if (index > -1) {
                    var collection = { ...collections[index] }
                    var index2 = collection.bookmarks.findIndex(x => x.postId === postId)
                    collection.bookmarks.splice(index2, 1)
                    if (collection.avatarIndex === index2) {
                        collection.avatarIndex = 0
                    }
                    collections[index] = collection
                }
            } else {
                collections = collections.map(collection => {
                    var index2 = collection.bookmarks.findIndex(x => x.postId === postId)
                    collection.bookmarks.splice(index2, 1)
                    if (collection.avatarIndex === index2
                        && collection.bookmarks.length > 0
                    ) {
                        collection.avatarIndex = 0
                    }
                    return { ...collection }
                })
            }
            collections = collections.filter(x => x.bookmarks.length > 0)
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_SUCCESS,
                payload: {
                    bookmarks: collections
                }
            })
        }
        catch (e) {
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_FAILURE,
                payload: {
                    message: `Can't not add collection now!`
                }
            })
        }
    }
}
export var MoveBookmarkToCollectionRequest = (fromCollectionName: string,
    targetCollectionName: string, postId: number):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var collections = [...(store.getState().user.bookmarks || [])]
            var fromCollectionIndex = collections.findIndex(x => x.name === fromCollectionName)
            var targetCollectionIndex = collections.findIndex(x => x.name === targetCollectionName)
            var fromBookmarkIndex = collections[fromCollectionIndex].bookmarks
                .findIndex(x => x.postId === postId)
            if (fromBookmarkIndex > -1) {
                var newFromCollection = {
                    ...collections[fromCollectionIndex],
                }
                var newTargetCollection = {
                    ...collections[targetCollectionIndex]
                }
                var bookmark = newFromCollection.bookmarks
                    .splice(fromBookmarkIndex, 1)[0]
                if (newFromCollection.avatarIndex === fromBookmarkIndex
                    && newFromCollection.bookmarks.length > 0
                ) {
                    newFromCollection.avatarIndex = 0
                }
                if (!newTargetCollection.bookmarks.find(x => x.postId === postId)) {
                    newTargetCollection.bookmarks.push(bookmark)
                }
                collections[fromCollectionIndex] = newFromCollection
                collections[targetCollectionIndex] = newTargetCollection
                if (newFromCollection.bookmarks.length === 0) {
                    collections.splice(fromCollectionIndex, 1)
                }
            }
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_SUCCESS,
                payload: {
                    bookmarks: collections
                }
            })
        }
        catch (e) {
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_FAILURE,
                payload: {
                    message: `Can't not add collection now!`
                }
            })
        }
    }
}
export var AddBookmarkToCollectionRequest = (
    collectionName: string, bookmarkList: Bookmark[]):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var collections = [...(store.getState().user.bookmarks || [])]
            var index = collections
                .findIndex(x => x.name === collectionName)
            if (index > -1) {
                var collection = { ...collections[index] }
                bookmarkList.map(bookmark => {
                    if (!collection.bookmarks
                        .find(x => x.postId === bookmark.postId)
                    ) {
                        collection.bookmarks.push({
                            ...bookmark
                        })
                    }
                })
                collections[index] = collection
            }
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_SUCCESS,
                payload: {
                    bookmarks: collections
                }
            })
        }
        catch (e) {
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_FAILURE,
                payload: {
                    message: `Can't not add collection now!`
                }
            })
        }
    }
}
export var UpdateBookmarkCollectionRequest = (collectionName: string, updatedCollection: BookmarkCollection):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var collections = [...(store.getState().user.bookmarks || [])]
            var index = collections
                .findIndex(x => x.name === collectionName)
            if (index > -1) {
                var collection = {
                    ...updatedCollection
                }
                collections[index] = collection
            }
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_SUCCESS,
                payload: {
                    bookmarks: collections
                }
            })
        }
        catch (e) {
            dispatch({
                type: userActionTypes.UPDATE_BOOKMARK_FAILURE,
                payload: {
                    message: `Can't not add collection now!`
                }
            })
        }
    }
}
//Archive Actions
export var FetchArchiveRequest = ():
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var ref = firestore()
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var rq = await ref.collection('users').doc(myUsername).get()
            var userData: ProfileX = rq.data() as ProfileX
            dispatch({
                type: userActionTypes.FETCH_ARCHIVE_SUCCESS,
                payload: {
                    archive: {
                        ...(userData.archive || {
                            posts: [],
                            stories: []
                        })
                    }
                }
            })
        }
        catch (e) {

        }
    }
}
export var AddStoryArchiveRequest = (storyList: StoryArchive[]):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var ref = firestore()
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var storyArchiveList = [...(store.getState().user
                .archive?.stories || [])]
            var postArchiveList = [...(store.getState().user
                .archive?.posts || [])]
            storyList.map(story => {
                if (!!!storyArchiveList.find(x => x.uid === story.uid)) {
                    storyArchiveList.push(story)
                }
            })
            var rq = await ref.collection('users').doc(myUsername).get()
            if (rq.exists) {
                await rq.ref.update({
                    archive: {
                        stories: storyArchiveList,
                        posts: postArchiveList
                    }
                })
            }
            dispatch(FetchArchiveRequest())
        }
        catch (e) {

        }
    }
}
export var AddPostArchiveRequest = (postList: PostArchive[]):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var ref = firestore()
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var storyArchiveList = [...(store.getState().user
                .archive?.stories || [])]
            var postArchiveList = [...(store.getState().user
                .archive?.posts || [])]
            postList.map(post => {
                if (!!!postArchiveList.find(x => x.uid === post.uid)) {
                    postArchiveList.push(post)
                }
            })
            var rq = await ref.collection('users').doc(myUsername).get()
            if (rq.exists) {
                await rq.ref.update({
                    archive: {
                        stories: storyArchiveList,
                        posts: postArchiveList
                    }
                })
            }
            dispatch(FetchArchiveRequest())
        }
        catch (e) {
            dispatch({
                type: userActionTypes.UPDATE_STORY_ARCHIVE_FAILURE,
                payload: {
                    message: `Can't not add to archive!`
                }
            })
        }
    }
}
export var RemovePostArchiveRequest = (uid: number):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var ref = firestore()
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var storyArchiveList = [...(store.getState().user
                .archive?.stories || [])]
            var postArchiveList = [...(store.getState().user
                .archive?.posts || [])]
            var index = postArchiveList.findIndex(x => x.uid === uid)
            postArchiveList.splice(index, 1)
            var rq = await ref.collection('users').doc(myUsername).get()
            if (rq.exists) {
                await rq.ref.update({
                    archive: {
                        stories: storyArchiveList,
                        posts: postArchiveList
                    }
                })
            }
            dispatch(FetchArchiveRequest())
        }
        catch (e) {
            dispatch({
                type: userActionTypes.UPDATE_STORY_ARCHIVE_FAILURE,
                payload: {
                    message: `Can't not remove to archive!`
                }
            })
        }
    }
}
//Highlight actions
export var FetchHighlightRequest = ():
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var ref = firestore()
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var rq = await ref.collection('users').doc(myUsername).get()
            var userData: ProfileX = rq.data() as ProfileX
            var highlights = (userData.highlights || [])
                .filter(x => x.stories.length > 0)
            dispatch({
                type: userActionTypes.FETCH_HIGHLIGHT_SUCCESS,
                payload: {
                    highlights,
                }
            })
        }
        catch (e) {

        }
    }
}
export var AddStoryToHighlightRequest = (storyList: StoryArchive[],
    targetHighlightName: string, avatarUri?: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var ref = firestore()
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var rq = await ref.collection('users').doc(`${myUsername}`).get()
            var currentHighLight = [...(store.getState().user.highlights || [])]
            var index = currentHighLight.findIndex(x => x.name === targetHighlightName)
            if (index > -1 && rq.exists) {
                var highlight = { ...currentHighLight[index] }
                var stories = [...highlight.stories]
                storyList.map(story => {
                    if (!!!stories.find(x => x.uid === story.uid)) {
                        stories.push(story)
                    }
                })
                currentHighLight[index] = {
                    ...highlight,
                    stories
                }
            } else if (avatarUri && index < 0) {
                currentHighLight.push({
                    name: targetHighlightName,
                    avatarUri,
                    stories: storyList
                })
            }
            await rq.ref.update({
                highlights: currentHighLight
            })
            dispatch(AddStoryArchiveRequest(storyList))
            dispatch(FetchHighlightRequest())
        }
        catch (e) {
            dispatch({
                type: userActionTypes.FETCH_HIGHLIGHT_FAILURE,
                payload: {
                    message: 'Load highlights failed'
                }
            })
        }
    }
}
export var RemoveFromHighlightRequest = (uid: number, targetHighlightName: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var ref = firestore()
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var rq = await ref.collection('users').doc(`${myUsername}`).get()
            var currentHighLight = [...(store.getState().user.highlights || [])]
            var index = currentHighLight.findIndex(x => x.name === targetHighlightName)
            if (index > -1) {
                var highlight = { ...currentHighLight[index] }
                var stories = [...highlight.stories]
                highlight.stories = stories.filter(x => x.uid !== uid)
                if (highlight.stories.length === 0) {
                    currentHighLight.splice(index, 1)
                } else currentHighLight[index] = highlight
                await rq.ref.update({
                    highlights: currentHighLight
                })
                dispatch(FetchHighlightRequest())
            }
        }
        catch (e) {
            dispatch({
                type: userActionTypes.FETCH_HIGHLIGHT_FAILURE,
                payload: {
                    message: 'Remove failed!'
                }
            })
        }
    }
}
export var RemoveHighlightRequest = (targetHighlightName: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var ref = firestore()
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var rq = await ref.collection('users').doc(`${myUsername}`).get()
            var currentHighLight = [...(store.getState().user.highlights || [])]
            var index = currentHighLight.findIndex(x => x.name === targetHighlightName)
            if (index > -1) {
                currentHighLight.splice(index, 1)
                await rq.ref.update({
                    highlights: currentHighLight
                })
                dispatch(FetchHighlightRequest())
            }
        }
        catch (e) {
            dispatch({
                type: userActionTypes.FETCH_HIGHLIGHT_FAILURE,
                payload: {
                    message: 'Remove failed!'
                }
            })
        }
    }
}
export var EditHighlightRequest = (editedHighlight: Highlight, targetHighlightName: string):
    ThunkAction<Promise<void>, {}, {}, userAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, userAction>) => {
        try {
            var ref = firestore()
            var myUsername = `${store.getState().user.user.userInfo?.username}`
            var rq = await ref.collection('users').doc(`${myUsername}`).get()
            var currentHighLight = [...(store.getState().user.highlights || [])]
            var index = currentHighLight.findIndex(x => x.name === targetHighlightName)
            if (index > -1) {
                currentHighLight[index] = { ...editedHighlight }
                await rq.ref.update({
                    highlights: currentHighLight
                })
                dispatch(FetchHighlightRequest())
            }
        }
        catch (e) {
            dispatch({
                type: userActionTypes.FETCH_HIGHLIGHT_FAILURE,
                payload: {
                    message: 'Remove failed!'
                }
            })
        }
    }
}