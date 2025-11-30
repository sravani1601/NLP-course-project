// src/routes/planRoutes.js

const express = require("express");
const router = express.Router();

const { postprocessPlan } = require("../services/planPostprocessor");
const { callChatGPTForPlan } = require("../services/chatActionService");

router.post("/", async (req, res) => {
    try {
        const userGoal = req.body.goal;
        const profile = req.body.profile;
        const busyIntervals = req.body.busy_intervals || req.body.busyIntervals;
        const modelName = req.body.model_name || req.body.modelName;

        if (!userGoal || typeof userGoal !== "string") {
            return res.status(400).json({ error: "Missing or invalid 'goal'" });
        }

        // 1. Call the LLM (Hugging Face model via Python)
        const rawOutput = await callChatGPTForPlan(userGoal, {
            profile,
            busyIntervals,
            modelName
        });

        // 2. Validate + normalize result
        const cleanPlan = postprocessPlan(rawOutput);

        // 3. Send response (include metadata if available)
        const response = {
            success: true,
            plan: cleanPlan
        };
        
        // Include metadata from raw output if available
        try {
            const rawData = JSON.parse(rawOutput);
            if (rawData.metadata) {
                response.metadata = rawData.metadata;
            }
        } catch (e) {
            // Metadata not available, continue without it
        }
        
        return res.json(response);
    } catch (err) {
        console.error("Plan generation error:", err);
        return res.status(400).json({ error: err.message });
    }
});

module.exports = router;

