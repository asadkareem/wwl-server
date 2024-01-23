import asyncHandler from "express-async-handler";
import axios from "axios";

const memberfulEndpoint = `https://${process.env.MEMBERFUL_ENDPOINT}`;

const environment = process.env.REACT_APP_CUSTOM_ENV;
let MEMBERFUL_API_KEY, MEMBERFUL_CLIENT_ID, MEMBERFUL_CLIENT_SECRET;

switch (environment) {
    case 'production':
        MEMBERFUL_API_KEY = process.env.MEMBERFUL_API_KEY;
        MEMBERFUL_CLIENT_ID = process.env.MEMBERFUL_CLIENT_ID;
        MEMBERFUL_CLIENT_SECRET = process.env.MEMBERFUL_CLIENT_SECRET;
        break;
    case 'beta':
        MEMBERFUL_API_KEY = process.env.REACT_APP_MEMBERFUL_ENTREMET_KEY;
        MEMBERFUL_CLIENT_ID = process.env.REACT_APP_MEMBERFUL_ENTREMET_ID;
        MEMBERFUL_CLIENT_SECRET =
            process.env.REACT_APP_MEMBERFUL_ENTREMET_SECRET;
        break;
    case 'staging':
        MEMBERFUL_API_KEY = process.env.REACT_APP_MEMBERFUL_NIGHTINGALE_KEY;
        MEMBERFUL_CLIENT_ID = process.env.REACT_APP_MEMBERFUL_NIGHTINGALE_ID;
        MEMBERFUL_CLIENT_SECRET =
            process.env.REACT_APP_MEMBERFUL_NIGHTINGALE_SECRET;
        break;
    default:
        MEMBERFUL_API_KEY = process.env.LOCAL_MEMBERFUL_API_KEY;
        MEMBERFUL_CLIENT_ID = process.env.LOCAL_MEMBERFUL_CLIENT_ID;
        MEMBERFUL_CLIENT_SECRET = process.env.LOCAL_MEMBERFUL_CLIENT_SECRET;
        break;
}


// Basic adds:
// Access to the site / the weekly meal plan with grocery list
// cannot edit meal plans/lists, but can still send to themselves.

// Pro adds:
// Meal planner
// ability to edit grocery lists and plans
// ability to edit weekly meal plan
// Meal plan archives


const memberfulPlanMap = {
    "42846": {
        "title": "WWL Meal Prep Program 1 Year",
        "hasMealPlanner": true,
        "hasShoppingListEditor": true,
        "hasMealPlanArchives": true,
    },

    "30418": {
        "title": "The WWL Meal Prep Program",
        "hasMealPlanner": true,
        "hasShoppingListEditor": true,
        "hasMealPlanArchives": true,
    },

    "34878": {
        "title": "WWL Meal Prep Program 6 Months",
        "hasMealPlanner": true,
        "hasShoppingListEditor": true,
        "hasMealPlanArchives": true,
    },

    "79422": {
        "title": "Basic 12 Month",
        "hasMealPlanner": false,
        "hasShoppingListEditor": false,
        "hasMealPlanArchives": false,
    },

    "86977": {
        "title": "Basic - Yearly Gift",
        "hasMealPlanner": false,
        "hasShoppingListEditor": false,
        "hasMealPlanArchives": false,
    },

    "86978": {
        "title": "Basic - Monthly",
        "hasMealPlanner": false,
        "hasShoppingListEditor": false,
        "hasMealPlanArchives": false,
    },

    "86980": {
        "title": "Pro - 12 month",
        "hasMealPlanner": true,
        "hasShoppingListEditor": true,
        "hasMealPlanArchives": true,
    },

    "86981": {
        "title": "Pro - Yearly Gift",
        "hasMealPlanner": true,
        "hasShoppingListEditor": true,
        "hasMealPlanArchives": true,
    },

    "86979": {
        "title": "Pro - Monthly",
        "hasMealPlanner": true,
        "hasShoppingListEditor": true,
        "hasMealPlanArchives": true,
    },

    // TODO: Remove these dummy plans
    // Dummy plans for testing
    "92789": {
        "title": "Pro - Monthly",
        "hasMealPlanner": true,
        "hasShoppingListEditor": true,
        "hasMealPlanArchives": true,
    },
};

export const permissionCheck = asyncHandler(async (req, res, next) => {
    try {
        const opts = {
            headers: {
                Authorization: `Bearer ${MEMBERFUL_API_KEY}`,
            },
        };

        const body = {
            query: `{
                memberByEmail(email: "${req.user.email}") {
                    fullName,
                    id,
                    subscriptions {
                        active plan {
                            name id
                        }
                    }
                }
            }`
        };

        const memberData = await axios.post(memberfulEndpoint, body, opts);
        const subscriptions = memberData.data.data.memberByEmail.subscriptions

        let memberfulPermissions = {
            "title": "Basic - Monthly",
            "hasMealPlanner": false,
            "hasShoppingListEditor": false,
            "hasMealPlanArchives": false,
        }

        for (let i = 0; i < subscriptions.length; i++) {
            if (subscriptions[i].active) {
                let planId = subscriptions[i].plan.id
                memberfulPermissions = memberfulPlanMap[planId]
            }
        }

        res.status(200).json(memberfulPermissions);
    } catch (e) {
        next(e);
    }
});


