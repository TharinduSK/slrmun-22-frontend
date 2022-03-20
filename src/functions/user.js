import { child, ref, remove, update } from "firebase/database";
import {
  ADMIN_USER_LEVEL,
  COMMITTEES_DOC_NAME,
  COMMITTEE_CHAIR_USER_LEVEL,
  DEVELOPER_USER_LEVEL,
  GENERAL_USER_LEVEL,
  USERS_DOC_NAME,
} from "../constants/general";

export const isSriLankan = (text) => {
  if (text) {
    const lowered_text = text.toLowerCase().trim();
    if (
      [
        "sl",
        "lk",
        "srilanka",
        "sri lanka",
        "sri-lanka",
        "srilankan",
        "sri lankan",
        "sri-lankan",
      ].includes(lowered_text)
    ) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

// returns the tabs to show for a specific user level
// array format = [PROFILE, COMMITTEE_SELECTION, PAYMENTS, FPS_SUBMISSION, DELEGATE_MANAGEMENT, USER_MANAGEMENT]
export const getUserVisibilityArray = (userLevel) => {
  let visibilityArr = [];
  if (userLevel === GENERAL_USER_LEVEL) {
    visibilityArr = [true, true, true, true, false, false];
  } else if (userLevel === COMMITTEE_CHAIR_USER_LEVEL) {
    visibilityArr = [true, true, false, false, true, false];
  } else if (userLevel === ADMIN_USER_LEVEL) {
    visibilityArr = [true, true, true, false, false, true];
  } else if (userLevel === DEVELOPER_USER_LEVEL) {
    visibilityArr = [true, true, true, true, true, true];
  }
  return visibilityArr;
};

export const getUserRegistrationStatus = (
  userData,
  paymentsFieldName,
  countryData,
  theme
) => {
  /* Registratsion status:
   * 6: Registered for a committee; country reserved for another delegate
   * 5: Registered for a committee; Payment made, Admin approved
   * 4: Not regitered for a committee; Payment made, Admin approved
   * 3: Not regitered for a committee; Payment made, Not admin approved
   * 2: Registered for a committee; Payment made, Not admin approved
   * 1: Registered for a committee; No payment made, Not admin approved
   * 0: Not regitered for a committee; No payment made, Not admin approved
   */

  if (countryData)
    if (
      countryData.availability === 0 &&
      countryData.reserved_to !== userData.user_id
    )
      // 6: Registered for a committee; country reserved for another delegate
      return [
        theme.palette.error.main,
        "Your requested country has been reserved to another registrant. Please select another",
        6,
      ];

  if (
    // 5: Registered for a committee; Payment made, Admin approved
    userData.admin_approved &&
    userData.committee_id !== undefined &&
    userData.country_id !== undefined
    // && userData[paymentsFieldName]
  )
    return [theme.palette.success.main, "You are all set!", 5];

  if (
    // 4: Not regitered for a committee; Payment made, Admin approved
    userData.admin_approved &&
    userData.committee_id === undefined &&
    userData.country_id === undefined &&
    userData[paymentsFieldName]
  )
    return [
      theme.palette.yellow.main,
      "Please register for a committee and a country",
      4,
    ];

  if (
    // 3: Not regitered for a committee; Payment made, Not admin approved
    !userData.admin_approved &&
    userData.committee_id === undefined &&
    userData.country_id === undefined &&
    userData[paymentsFieldName]
  )
    return [
      theme.palette.yellow.main,
      "Please request a committee and a country",
      3,
    ];

  if (
    // 2: Registered for a committee; Payment made, Not admin approved
    !userData.admin_approved &&
    userData.committee_id !== undefined &&
    userData.country_id !== undefined &&
    userData[paymentsFieldName]
  )
    return [
      theme.palette.yellow.main,
      "Please wait for admin approval to confirm your request",
      2,
    ];

  if (
    // 1: Registered for a committee; No payment made, Not admin approved
    !userData.admin_approved &&
    userData.committee_id !== undefined &&
    userData.country_id !== undefined &&
    !userData[paymentsFieldName]
  )
    return [
      theme.palette.orange.main,
      "Please make the payment and wait for admin approval to confirm your request",
      1,
    ];

  if (
    // 0: Not regitered for a committee; No payment made, Not admin approved
    !userData.admin_approved &&
    userData.committee_id === undefined &&
    userData.country_id === undefined &&
    !userData[paymentsFieldName]
  )
    return [
      theme.palette.error.main,
      "Please request a committee and a country",
      0,
    ];

  return [theme.palette.error.main, "Error, Please contact the admin", 0];
};

export const userLevelToString = (userLevel) => {
  if (userLevel === 0) return "Delegate";
  if (userLevel === 1) return "Committee Chairperson";
  if (userLevel === 2) return "Admin";
  if (userLevel === 3) return "Developer";
  return "Undefined User Level";
};

export const getCommitteeAndCountryFromNumbers = (
  committee_id,
  country_id,
  committeesData
) => {
  let committee = "None";
  let country = "None";
  if (committee_id) committee = committeesData[committee_id].short_name;
  if (committee_id && country_id)
    country = committeesData[committee_id].countries[country_id].name;

  return [committee, country];
};

export const getCurrentStatusFromNumber = (number) => {
  if (parseInt(number) === 0) return "School Student";
  if (parseInt(number) === 1) return "University Student";
  if (parseInt(number) === 2) return "Employeed";
  return "Undefined currentStatusNumber";
};

const parseIntHandleEmptyString = (string) => {
  if (string === "") return 0;
  else return parseInt(string);
};

export const stringObjectToArray = (committeeObj) => {
  const returnObj = {};
  if (Object.keys(committeeObj).length > 0) {
    for (const committee in committeeObj) {
      if (Object.hasOwnProperty.call(committeeObj, committee)) {
        const string = committeeObj[committee];
        const countryObj = {};
        const lst = string.split("\r\n");
        delete lst[0]; // delete the header

        // convert the string in each line to objects
        for (
          let countryRowIndex = 0;
          countryRowIndex < lst.length;
          countryRowIndex++
        ) {
          const countryRow = lst[countryRowIndex];
          if (countryRow) {
            const countryArr = countryRow.split(",");
            countryObj[countryArr[0]] = parseIntHandleEmptyString(
              countryArr[2]
            );
          }
        }

        returnObj[committee] = countryObj;
      }
    }
  }
  return returnObj;
};

export const updateUserCountry = (
  userData,
  oldCountryId,
  oldCommitteeId,
  firebaseDb,
  newCommitteeId,
  newCountryId,
  committeesData
) => {
  // if forced is set to true, if the new country has been reserved to another delegate, the two countries will be interchanged

  const userId = userData.user_id;
  const userRef = ref(firebaseDb, USERS_DOC_NAME + "/" + userId);

  // creates the country references
  let oldCountryRef = undefined;
  if (oldCountryId) {
    oldCountryRef = ref(
      firebaseDb,
      COMMITTEES_DOC_NAME + "/" + oldCommitteeId + "/countries/" + oldCountryId
    );
  }
  const newContryRef = ref(
    firebaseDb,
    COMMITTEES_DOC_NAME + "/" + newCommitteeId + "/countries/" + newCountryId
  );

  // update the database
  const newCountry = committeesData[newCommitteeId].countries[newCountryId];
  const current_time = new Date().getTime();

  // checks if the country is still available (to handle simultaneos updates)
  if (newCountry.availability === 1) {
    updateUserCountryDirect(
      oldCommitteeId,
      oldCountryId,
      newCommitteeId,
      newCountryId,
      oldCountryRef,
      newContryRef,
      committeesData,
      current_time,
      userData,
      userRef
    );
  }
};

export const exchangeUserCountry = (
  newUserData,
  oldUserData,
  oldCountryId,
  oldCommitteeId,
  firebaseDb,
  newCommitteeId,
  newCountryId,
  committeesData
) => {
  const newUserId = newUserData.user_id;
  const newUserRef = ref(firebaseDb, USERS_DOC_NAME + "/" + newUserId);

  const oldUserId = oldUserData.user_id;
  const oldUserRef = ref(firebaseDb, USERS_DOC_NAME + "/" + oldUserId);

  // creates the country references
  let oldCountryRef = undefined;
  if (oldCountryId) {
    oldCountryRef = ref(
      firebaseDb,
      COMMITTEES_DOC_NAME + "/" + oldCommitteeId + "/countries/" + oldCountryId
    );
  }
  const newContryRef = ref(
    firebaseDb,
    COMMITTEES_DOC_NAME + "/" + newCommitteeId + "/countries/" + newCountryId
  );

  // update the database
  const current_time = new Date().getTime();

  // update the old user
  updateUserCountryDirect(
    newCommitteeId,
    newCountryId,
    oldCommitteeId,
    oldCountryId,
    newContryRef,
    oldCountryRef,
    committeesData,
    current_time,
    oldUserData,
    oldUserRef
  );

  // update the new user
  updateUserCountryDirect(
    oldCommitteeId,
    oldCountryId,
    newCommitteeId,
    newCountryId,
    oldCountryRef,
    newContryRef,
    committeesData,
    current_time,
    newUserData,
    newUserRef
  );
};

const updateUserCountryDirect = (
  oldCommitteeId,
  oldCountryId,
  newCommitteeId,
  newCountryId,
  oldCountryRef,
  newContryRef,
  committeesData,
  current_time,
  userData,
  userRef
) => {
  let oldCountryUpdate = {};
  let newCountryUpdate = {};
  const userId = userData.user_id;
  // update the request list of the new country
  // update the request list and the availability of the old country
  if (oldCountryId) {
    const oldCountry = committeesData[oldCommitteeId].countries[oldCountryId];

    // delete the requests from the old country
    if (oldCountry.requests) {
      // finds the timestamps the user has has selected the country. This will have always one occerence if no error has occured
      const occurences = [];
      for (const timestamp in oldCountry.requests) {
        if (Object.hasOwnProperty.call(oldCountry.requests, timestamp)) {
          const uid = oldCountry.requests[timestamp];
          if (uid === userId) {
            occurences.push(timestamp);
          }
        }
      }
      // delete the occurences (a single one if no errors/manual mutilations for the database had occured) from the database
      for (let i = 0; i < occurences.length; i++) {
        const timestamp = occurences[i];
        remove(child(oldCountryRef, "/requests/" + timestamp));
      }
    }

    // make the country available if if was reserved to this fellow
    if (oldCountry.reserved_to === userId) {
      oldCountryUpdate = { reserved_to: "", availability: 1 };
    }
  }

  // update list to update the user
  const userUpdates = {
    committee_id: newCommitteeId,
    country_id: newCountryId,
  };

  // update the country data (reserve) if approved by the admin
  if (userData.admin_approved) {
    userUpdates.country_reserved = true;
    newCountryUpdate = {
      availability: 0,
      reserved_to: userData.user_id,
    };
  }

  ////////////////////////////////////////////////////////////////////
  // update the request list of the new country
  // update the request list and the availability of the old country
  update(oldCountryRef, oldCountryUpdate);

  // update the country data (reserve) if approved by the admin
  if (userData.admin_approved) {
    update(newContryRef, newCountryUpdate);
  }
  // add the request from this user
  update(child(newContryRef, "requests"), {
    [current_time]: userId,
  });

  // updates the user
  update(userRef, userUpdates);
};

const updateReservedUser = () => {};
