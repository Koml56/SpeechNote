import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, insertAudioRecordingSchema, insertTextNoteSchema } from "@shared/schema";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Function to convert transcriptions to formatted recipe
async function convertToRecipe(title: string, transcriptions: string[]): Promise<string> {
  try {
    const prompt = `Convert the following voice notes into a properly formatted recipe. Only respond with the recipe format, nothing else.

Title: ${title}

Voice Notes:
${transcriptions.map((text, index) => `Message ${index + 1}: ${text}`).join('\n')}

Format the response as a proper recipe with ingredients and instructions. Do not include any other text or commentary.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: "You are a chef assistant that converts voice notes into properly formatted recipes. Only respond with the recipe format, no additional text.",
      },
      contents: prompt,
    });

    return response.text || "Could not generate recipe.";
  } catch (error) {
    console.error('Recipe conversion error:', error);
    throw new Error("Failed to convert to recipe");
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Recipe routes
  app.get("/api/recipes", async (req, res) => {
    try {
      const recipes = await storage.getRecipes();
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recipes" });
    }
  });

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recipeData = await storage.getRecipeWithContent(id);
      
      if (!recipeData) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      res.json(recipeData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recipe" });
    }
  });

  app.post("/api/recipes", async (req, res) => {
    try {
      const recipeData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.createRecipe(recipeData);
      res.status(201).json(recipe);
    } catch (error) {
      res.status(400).json({ message: "Invalid recipe data" });
    }
  });

  app.delete("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRecipe(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete recipe" });
    }
  });

  // Audio recording routes
  app.post("/api/recipes/:recipeId/audio-recordings", async (req, res) => {
    try {
      const recipeId = parseInt(req.params.recipeId);
      const recordingData = insertAudioRecordingSchema.parse({
        ...req.body,
        recipeId
      });

      // Transcription will be handled on the frontend
      let transcription = recordingData.transcription || null;

      const recording = await storage.createAudioRecording({
        ...recordingData,
        transcription
      });
      res.status(201).json(recording);
    } catch (error) {
      res.status(400).json({ message: "Invalid recording data" });
    }
  });

  app.delete("/api/audio-recordings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAudioRecording(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete recording" });
    }
  });

  // Text note routes
  app.post("/api/recipes/:recipeId/text-notes", async (req, res) => {
    try {
      const recipeId = parseInt(req.params.recipeId);
      const noteData = insertTextNoteSchema.parse({
        ...req.body,
        recipeId
      });
      const note = await storage.createTextNote(noteData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ message: "Invalid note data" });
    }
  });

  // Convert to recipe route
  app.post("/api/recipes/:recipeId/convert-to-recipe", async (req, res) => {
    try {
      const recipeId = parseInt(req.params.recipeId);
      const recipeData = await storage.getRecipeWithContent(recipeId);
      
      if (!recipeData) {
        return res.status(404).json({ message: "Recipe not found" });
      }

      // Extract transcriptions from audio recordings
      const transcriptions = recipeData.audioRecordings
        .filter(recording => recording.transcription)
        .map(recording => recording.transcription!);

      // Add text notes
      const textNotes = recipeData.textNotes.map(note => note.content);
      const allContent = [...transcriptions, ...textNotes];

      if (allContent.length === 0) {
        return res.status(400).json({ message: "No content to convert to recipe" });
      }

      const formattedRecipe = await convertToRecipe(recipeData.recipe.name, allContent);
      
      // Save the formatted recipe as a text note
      const recipeNote = await storage.createTextNote({
        recipeId,
        content: `🍳 Generated Recipe:\n\n${formattedRecipe}`
      });

      res.status(201).json({ recipe: formattedRecipe, note: recipeNote });
    } catch (error) {
      console.error('Convert to recipe error:', error);
      res.status(500).json({ message: "Failed to convert to recipe" });
    }
  });

  app.delete("/api/text-notes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTextNote(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
