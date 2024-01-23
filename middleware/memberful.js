import axios from 'axios';
import User from "../models/userModel.js";
import {BadRequest} from "../utilis/errors.js";
import * as dotenv from "dotenv";

dotenv.config();



const ENV = process.env.CUSTOM_ENV;
const MEMBERFUL_ENDPOINT = process.env.MEMBERFUL_ENDPOINT;
const MEMBERFUL_AUTH_ENDPOINT = process.env.MEMBERFUL_AUTH_ENDPOINT;
const MEMBERFUL_API_KEY = process.env.MEMBERFUL_API_KEY;
const MEMBERFUL_CLIENT_ID = process.env.MEMBERFUL_CLIENT_ID;
const MEMBERFUL_CLIENT_SECRET = process.env.MEMBERFUL_CLIENT_SECRET;

let validSubscriptionIDs = []

if (ENV == 'local') {
  validSubscriptionIDs = [ '92789' ]
} else {
  validSubscriptionIDs = [ "42846", "30418", "34878", "79422", "86977", "86978", "86980", "86981", "86979" ];
}

// User Credentials =======================================
async function validateThroughMemberfulWithCredentials(email, password) {
  const member = await authenticateMemberWithCredentials(email, password);

  if (member && member.access_token) {
    return {isValid: true};
  }

  return {isValid: false, error: member.response.data.error_description};
}

async function authenticateMemberWithCredentials(email, password) {
  const body = {
    client_id: MEMBERFUL_CLIENT_ID,
    client_secret: MEMBERFUL_CLIENT_SECRET,
    grant_type: 'password',
    username: email,
    password,
  };
  try {
    const member = await axios.post(MEMBERFUL_AUTH_ENDPOINT, body);
    return member.data;
  } catch (e) {
    throw e;
  }
}

async function checkIfCurrentMember(email, userRoot) {
  let subscriptions;

  if (userRoot?.subscriptions) {
    subscriptions = userRoot.subscriptions;
  } else {
    const member = await fetchMemberfulUserByEmail(email);
    if (!member) return false;

    subscriptions = member.subscriptions;
  }

  let isCurrentMember = false;
  subscriptions.forEach((sub) => {
    if (validSubscriptionIDs.includes(sub.plan.id)) {
      if (sub.active) {
        isCurrentMember = true;
      }
    }
  });

  return isCurrentMember;
}

async function fetchMemberfulUserByEmail(email) {
  const opts = {
    headers: {
      Authorization: `Bearer ${MEMBERFUL_API_KEY}`,
    },
  };

  const body = {
    query: queryMember(email),
  };


  try {
    const memberData = await axios.post(MEMBERFUL_ENDPOINT, body, opts);
    return memberData.data.data.memberByEmail;
  } catch (e) {
    // console.log(e)
    throw new Error(`${e}: Memberful Fetch Member`);
  }
}

function queryMember(email) {
  // const emailQuery = `{memberByEmail(email: "${email}"){fullName, id, subscriptions {active plan{name id}}}}`;

  const emailQuery = `{memberByEmail(email:"${email}"){id,username,fullName,email}}`

  return emailQuery;
}

// ========================================================

// Auth Code ==============================================

async function authenticateMemberWithAuthCode(code) {
  try {
    const url = `https://${MEMBERFUL_AUTH_ENDPOINT}?grant_type=authorization_code&client_id=${MEMBERFUL_CLIENT_ID}&client_secret=${MEMBERFUL_CLIENT_SECRET}&code=${code}`
    const tokens = await axios.post(url);
    return tokens.data;
  } catch (e) {
    console.log(e)
    throw e;
  }
}

async function fetchCurrentMemberfulUser(accessToken) {
  const query = `{currentMember{fullName, email, id, subscriptions {active plan{name id}}}}`;

  const opts = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  try {
    const memberData = await axios(
      `https://${MEMBERFUL_ENDPOINT}/member?query=${query}`,
      opts
    );
    return memberData.data.data.currentMember;
  } catch (e) {
    throw new Error(`${e}: Memberful Fetch Member`);
  }
}

async function refreshAccessToken(refreshToken) {
  const body = {
    client_id: MEMBERFUL_CLIENT_ID,
    client_secret: MEMBERFUL_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refreshToken,
  };

  try {
    const member = await axios.post(MEMBERFUL_AUTH_ENDPOINT, body);
    return member.data;
  } catch (e) {
    return e;
  }
}

// ========================================================

const authenticateThroughMemberful = async (params) => {
  const {email, password, authCode} = params;

  let userRoot;

  if (authCode) {
    // Validate through Memberful email sign in
    const res = await authenticateMemberWithAuthCode(authCode);
    const {access_token} = res;

    userRoot = await fetchCurrentMemberfulUser(access_token);
  } else {
    // Validate through user credentials
    const memberfulValidation = await validateThroughMemberfulWithCredentials(
      email,
      password
    );

    if (!memberfulValidation.isValid) {
      throw new BadRequest(memberfulValidation.error);
    }

    userRoot = await fetchMemberfulUserByEmail(email);
  }

  const {id: memberfulId, fullName, email: emailFromMemberfulAPI} = userRoot;

  const isCurrentMember = await checkIfCurrentMember(
    email || emailFromMemberfulAPI,
    userRoot
  );

  let [user] = await User.find({email: emailFromMemberfulAPI})

  if (user) {
    user = await User.findByIdAndUpdate(user._id, {
      is_active: isCurrentMember,
      email: emailFromMemberfulAPI || email,
      name: fullName,
    }, {
      new: true,
      runValidators: true
    })
    return user
  } else {
    user = await User.create({
      memberful_id: memberfulId,
      email: emailFromMemberfulAPI || email,
      avatar: "avatar.jpg",
      name: fullName,
      is_active: isCurrentMember,
      is_admin: false,
      primary_diet: 'omnivore',
      family_size: 1,
      unit_preference: 'imperial',
      is_gluten_free: false,
      is_dairy_free: false,
      favorite_recipes: [],
      bookmarked_recipes: [],
      shopping_lists: []
    });

    return user
  }
};

export {
  authenticateThroughMemberful,
  checkIfCurrentMember,
  fetchMemberfulUserByEmail,
};
