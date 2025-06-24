import { 
  recipes, 
  audioRecordings, 
  textNotes,
  type Recipe, 
  type InsertRecipe,
  type AudioRecording,
  type InsertAudioRecording,
  type TextNote,
  type InsertTextNote
} from "@shared/schema";

export interface IStorage {
  // Recipe operations
  getRecipes(): Promise<Recipe[]>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  deleteRecipe(id: number): Promise<void>;

  // Audio recording operations
  getAudioRecordings(recipeId: number): Promise<AudioRecording[]>;
  createAudioRecording(recording: InsertAudioRecording): Promise<AudioRecording>;
  deleteAudioRecording(id: number): Promise<void>;

  // Text note operations
  getTextNotes(recipeId: number): Promise<TextNote[]>;
  createTextNote(note: InsertTextNote): Promise<TextNote>;
  deleteTextNote(id: number): Promise<void>;

  // Combined data
  getRecipeWithContent(id: number): Promise<{
    recipe: Recipe;
    audioRecordings: AudioRecording[];
    textNotes: TextNote[];
  } | undefined>;
}

export class MemStorage implements IStorage {
  private recipes: Map<number, Recipe>;
  private audioRecordings: Map<number, AudioRecording>;
  private textNotes: Map<number, TextNote>;
  private currentRecipeId: number;
  private currentAudioRecordingId: number;
  private currentTextNoteId: number;

  constructor() {
    this.recipes = new Map();
    this.audioRecordings = new Map();
    this.textNotes = new Map();
    this.currentRecipeId = 1;
    this.currentAudioRecordingId = 1;
    this.currentTextNoteId = 1;
  }

  async getRecipes(): Promise<Recipe[]> {
    return Array.from(this.recipes.values());
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    return this.recipes.get(id);
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const id = this.currentRecipeId++;
    const recipe: Recipe = {
      ...insertRecipe,
      id,
      createdAt: new Date(),
    };
    this.recipes.set(id, recipe);
    return recipe;
  }

  async deleteRecipe(id: number): Promise<void> {
    this.recipes.delete(id);
    // Also delete associated recordings and notes
    Array.from(this.audioRecordings.entries()).forEach(([recordingId, recording]) => {
      if (recording.recipeId === id) {
        this.audioRecordings.delete(recordingId);
      }
    });
    Array.from(this.textNotes.entries()).forEach(([noteId, note]) => {
      if (note.recipeId === id) {
        this.textNotes.delete(noteId);
      }
    });
  }

  async getAudioRecordings(recipeId: number): Promise<AudioRecording[]> {
    return Array.from(this.audioRecordings.values()).filter(
      recording => recording.recipeId === recipeId
    );
  }

  async createAudioRecording(insertRecording: InsertAudioRecording): Promise<AudioRecording> {
    const id = this.currentAudioRecordingId++;
    const recording: AudioRecording = {
      ...insertRecording,
      id,
      createdAt: new Date(),
      transcription: insertRecording.transcription || null,
    };
    this.audioRecordings.set(id, recording);
    return recording;
  }

  async deleteAudioRecording(id: number): Promise<void> {
    this.audioRecordings.delete(id);
  }

  async getTextNotes(recipeId: number): Promise<TextNote[]> {
    return Array.from(this.textNotes.values()).filter(
      note => note.recipeId === recipeId
    );
  }

  async createTextNote(insertNote: InsertTextNote): Promise<TextNote> {
    const id = this.currentTextNoteId++;
    const note: TextNote = {
      ...insertNote,
      id,
      createdAt: new Date(),
    };
    this.textNotes.set(id, note);
    return note;
  }

  async deleteTextNote(id: number): Promise<void> {
    this.textNotes.delete(id);
  }

  async getRecipeWithContent(id: number): Promise<{
    recipe: Recipe;
    audioRecordings: AudioRecording[];
    textNotes: TextNote[];
  } | undefined> {
    const recipe = await this.getRecipe(id);
    if (!recipe) return undefined;

    const audioRecordings = await this.getAudioRecordings(id);
    const textNotes = await this.getTextNotes(id);

    return {
      recipe,
      audioRecordings,
      textNotes,
    };
  }
}

export const storage = new MemStorage();
