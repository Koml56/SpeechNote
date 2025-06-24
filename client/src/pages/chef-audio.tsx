import React, { useState, useEffect } from 'react';
import { Mic, Plus, ChevronDown, Check, Play, Pause, X } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { formatDuration, createAudioUrl } from '@/lib/audio-utils';
import { useToast } from '@/hooks/use-toast';
import type { Recipe, AudioRecording, TextNote } from '@shared/schema';

interface RecipeWithContent {
  recipe: Recipe;
  audioRecordings: AudioRecording[];
  textNotes: TextNote[];
}

const ChefAudioApp = () => {
  const [currentRecipeId, setCurrentRecipeId] = useState<number | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textNote, setTextNote] = useState('');
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [audioElements, setAudioElements] = useState<Map<number, HTMLAudioElement>>(new Map());
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const { toast } = useToast();
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    hasPermission,
    requestPermission,
  } = useAudioRecorder();

  // Fetch all recipes
  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ['/api/recipes'],
  });

  // Fetch current recipe with content
  const { data: currentRecipeData, isLoading: isLoadingRecipeData } = useQuery<RecipeWithContent>({
    queryKey: ['recipe-with-content', currentRecipeId],
    queryFn: async () => {
      const response = await fetch(`/api/recipes/${currentRecipeId}`);
      if (!response.ok) throw new Error('Failed to fetch recipe');
      return response.json();
    },
    enabled: !!currentRecipeId,
  });

  // Create recipe mutation
  const createRecipeMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest('POST', '/api/recipes', { name });
      return response.json();
    },
    onSuccess: (recipe: Recipe) => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      setCurrentRecipeId(recipe.id);
      setNewRecipeName('');
      setShowNameInput(false);
      toast({ title: 'Recipe created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create recipe', variant: 'destructive' });
    },
  });

  // Create audio recording mutation
  const createAudioRecordingMutation = useMutation({
    mutationFn: async (data: { name: string; duration: number; audioData: string; mimeType: string; transcription?: string }) => {
      const response = await apiRequest('POST', `/api/recipes/${currentRecipeId}/audio-recordings`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-with-content', currentRecipeId] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      toast({ title: 'Recording saved and transcribed!' });
    },
    onError: () => {
      toast({ title: 'Failed to save recording', variant: 'destructive' });
    },
  });

  // Create text note mutation
  const createTextNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', `/api/recipes/${currentRecipeId}/text-notes`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-with-content', currentRecipeId] });
      setTextNote('');
      setShowTextInput(false);
      toast({ title: 'Note added successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to add note', variant: 'destructive' });
    },
  });

  // Convert to recipe mutation
  const convertToRecipeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/recipes/${currentRecipeId}/convert-to-recipe`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-with-content', currentRecipeId] });
      toast({ title: 'Recipe generated successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to generate recipe', variant: 'destructive' });
    },
  });

  // Set initial recipe and request microphone permission
  useEffect(() => {
    if (recipes.length > 0 && !currentRecipeId) {
      setCurrentRecipeId(recipes[0].id);
    } else if (recipes.length === 0 && !showNameInput && !currentRecipeId) {
      setShowNameInput(true);
    }
  }, [recipes, currentRecipeId, showNameInput]);

  // Request microphone permission on component mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Handle recording
  const handleRecordStart = async () => {
    if (!currentRecipeId) return;
    
    if (!hasPermission) {
      setShowPermissionModal(true);
      return;
    }
    
    await startRecording();
  };

  const handleRecordStop = async () => {
    if (!currentRecipeId) return;
    
    const result = await stopRecording();
    if (result) {
      const existingRecordings = currentRecipeData?.audioRecordings || [];
      const recordingName = `Recording ${existingRecordings.length + 1}`;
      createAudioRecordingMutation.mutate({
        name: recordingName,
        duration: result.duration,
        audioData: result.audioData,
        mimeType: result.mimeType,
        transcription: result.transcription,
      });
    }
  };

  // Handle audio playback
  const toggleAudioPlayback = (recording: AudioRecording) => {
    const audioElement = audioElements.get(recording.id);
    
    if (audioElement) {
      if (playingAudio === recording.id) {
        audioElement.pause();
        setPlayingAudio(null);
      } else {
        // Pause any currently playing audio
        audioElements.forEach((audio, id) => {
          if (id !== recording.id) {
            audio.pause();
          }
        });
        
        audioElement.play();
        setPlayingAudio(recording.id);
      }
    } else {
      // Create new audio element
      const audioUrl = createAudioUrl(recording.audioData, recording.mimeType);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => setPlayingAudio(null);
      audio.onpause = () => setPlayingAudio(null);
      
      setAudioElements(prev => new Map(prev).set(recording.id, audio));
      audio.play();
      setPlayingAudio(recording.id);
    }
  };

  // Create new recipe
  const createRecipe = () => {
    if (!newRecipeName.trim()) return;
    createRecipeMutation.mutate(newRecipeName.trim());
  };

  // Add text note
  const addTextNote = () => {
    if (!textNote.trim() || !currentRecipeId) return;
    createTextNoteMutation.mutate(textNote.trim());
  };

  // Switch to different recipe
  const switchRecipe = (recipe: Recipe) => {
    setCurrentRecipeId(recipe.id);
    setShowRecipeSelector(false);
  };

  const currentRecipe = currentRecipeData?.recipe;
  const audioRecordings = currentRecipeData?.audioRecordings || [];
  const textNotes = currentRecipeData?.textNotes || [];
  const totalItems = audioRecordings.length + textNotes.length;





  // Name input screen
  if (showNameInput || (!currentRecipe && recipes.length === 0)) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="pt-14 pb-8 px-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">New Recipe</h1>
            <p className="text-gray-500 text-sm">Give your recipe a name to get started</p>
          </div>
        </div>

        {/* Input Section */}
        <div className="px-6">
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <input
              type="text"
              placeholder="Recipe name"
              value={newRecipeName}
              onChange={(e) => setNewRecipeName(e.target.value)}
              className="w-full bg-transparent text-lg font-medium text-gray-900 placeholder-gray-400 outline-none"
              onKeyPress={(e) => e.key === 'Enter' && createRecipe()}
              autoFocus
            />
          </div>

          <button
            onClick={createRecipe}
            disabled={!newRecipeName.trim() || createRecipeMutation.isPending}
            className={`w-full py-4 rounded-2xl font-semibold text-white transition-all ${
              newRecipeName.trim() && !createRecipeMutation.isPending
                ? 'bg-blue-500 hover:bg-blue-600 active:scale-95'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {createRecipeMutation.isPending ? 'Creating...' : 'Create Recipe'}
          </button>
        </div>

        {/* Recent recipes */}
        {recipes.length > 0 && (
          <div className="px-6 mt-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Recipes</h3>
            <div className="space-y-3">
              {recipes.slice(-3).reverse().map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => {
                    setCurrentRecipeId(recipe.id);
                    setShowNameInput(false);
                  }}
                  className="w-full p-4 bg-gray-50 rounded-2xl text-left hover:bg-gray-100 transition-colors"
                >
                  <div className="font-medium text-gray-900">{recipe.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {recipe.createdAt && new Date(recipe.createdAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Recipe selector overlay
  if (showRecipeSelector) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-14 pb-6">
          <button
            onClick={() => setShowRecipeSelector(false)}
            className="text-blue-500 font-medium"
          >
            Cancel
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Select Recipe</h1>
          <button
            onClick={() => {
              setShowRecipeSelector(false);
              setShowNameInput(true);
            }}
            className="text-blue-500"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Recipes list */}
        <div className="px-6">
          {recipes.map(recipe => (
            <button
              key={recipe.id}
              onClick={() => switchRecipe(recipe)}
              className="w-full p-4 mb-3 bg-gray-50 rounded-2xl text-left hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{recipe.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {recipe.createdAt && new Date(recipe.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {currentRecipe?.id === recipe.id && (
                  <Check className="w-5 h-5 text-blue-500" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Permission modal
  if (showPermissionModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Microphone Access</h3>
            <p className="text-gray-500 text-sm mb-6">Chef Audio needs access to your microphone to record voice notes for your recipes.</p>
            <button 
              onClick={async () => {
                const granted = await requestPermission();
                if (granted) {
                  setShowPermissionModal(false);
                }
              }}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors active:scale-95"
            >
              Allow Microphone Access
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main recording interface
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-14 pb-6 bg-white/90 backdrop-blur-sm sticky top-0 z-40">
        <button
          onClick={() => setShowRecipeSelector(true)}
          className="flex items-center space-x-1 text-blue-500 hover:text-blue-600 transition-colors"
        >
          <span className="font-medium">{currentRecipe?.name || 'Loading...'}</span>
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowNameInput(true)}
          className="text-blue-500 hover:text-blue-600 transition-colors p-2"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Recording Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Recording timer */}
        {isRecording && (
          <div className="mb-8 text-center transition-opacity duration-300">
            <div className="text-4xl font-light text-red-500 mb-2">
              {formatDuration(recordingDuration)}
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-500 text-sm font-medium">Recording</span>
            </div>
          </div>
        )}

        {/* Waveform visualization */}
        {isRecording && (
          <div className="mb-8 transition-opacity duration-300">
            <div className="flex items-end justify-center space-x-1 h-16">
              {[0, 100, 200, 300, 400, 300, 200, 100, 0].map((delay, index) => (
                <div
                  key={index}
                  className="w-1 bg-blue-500 rounded-full animate-pulse"
                  style={{
                    animationDelay: `${delay}ms`,
                    height: '20%',
                    animation: 'pulse 1.5s ease-in-out infinite'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Record Button */}
        <div className="relative mb-8">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              handleRecordStart();
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              handleRecordStop();
            }}
            onMouseLeave={(e) => {
              e.preventDefault();
              handleRecordStop();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              handleRecordStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleRecordStop();
            }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 select-none ${
              isRecording 
                ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/30' 
                : 'bg-blue-500 hover:bg-blue-600 shadow-lg active:scale-95'
            }`}
          >
            {isRecording ? (
              <div className="w-6 h-6 bg-white rounded"></div>
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </button>
          {isRecording && (
            <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping"></div>
          )}
        </div>

        <p className="text-gray-500 text-center text-sm max-w-xs transition-all duration-300">
          {isRecording ? 'Release to stop recording & transcribe' : 'Hold to record - speech will be automatically transcribed'}
        </p>

        {/* Action buttons */}
        <div className="mt-8 flex flex-col space-y-3">
          <button
            onClick={() => setShowTextInput(true)}
            className="px-6 py-3 bg-gray-100 rounded-full text-gray-700 font-medium hover:bg-gray-200 transition-colors active:scale-95"
          >
            Add Text Note
          </button>
          
          {totalItems > 0 && (
            <button
              onClick={() => convertToRecipeMutation.mutate()}
              disabled={convertToRecipeMutation.isPending}
              className="px-6 py-3 bg-green-500 rounded-full text-white font-medium hover:bg-green-600 transition-colors active:scale-95 disabled:opacity-50"
            >
              {convertToRecipeMutation.isPending ? 'Generating...' : '🍳 Convert to Recipe'}
            </button>
          )}
        </div>
      </div>

      {/* Recordings List */}
      {totalItems > 0 && (
        <div className="px-6 pb-8">
          <div className="bg-gray-50 rounded-2xl p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              {totalItems} Items
            </h3>
            
            <div className="space-y-3">
              {/* Audio recordings */}
              {audioRecordings.map((recording, index) => (
                <div key={recording.id} className="flex items-start justify-between py-2 group">
                  <div className="flex items-start space-x-3">
                    <button
                      onClick={() => toggleAudioPlayback(recording)}
                      className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors group-hover:scale-105 mt-1"
                    >
                      {playingAudio === recording.id ? (
                        <Pause className="w-4 h-4 text-white" />
                      ) : (
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{recording.name}</div>
                      <div className="text-xs text-gray-500 mb-1">
                        {formatDuration(recording.duration)} • {new Date(recording.createdAt).toLocaleTimeString()}
                      </div>
                      {recording.transcription && (
                        <div className="text-sm text-gray-800 bg-gray-100 rounded-lg p-2 mt-2">
                          <div className="text-xs text-gray-500 mb-1">Transcription:</div>
                          {recording.transcription}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Text notes */}
              {textNotes.map((note) => (
                <div key={note.id} className="py-2 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className={`text-sm mb-1 ${note.content.startsWith('🍳 Generated Recipe:') 
                        ? 'text-green-800 bg-green-50 p-3 rounded-lg whitespace-pre-line' 
                        : 'text-gray-900'}`}>
                        {note.content}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(note.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Text input overlay */}
      {showTextInput && (
        <div className="fixed inset-0 bg-white z-50">
          <div className="flex items-center justify-between px-6 pt-14 pb-6">
            <button
              onClick={() => {
                setShowTextInput(false);
                setTextNote('');
              }}
              className="text-blue-500 font-medium"
            >
              Cancel
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Add Note</h1>
            <button
              onClick={addTextNote}
              disabled={!textNote.trim() || createTextNoteMutation.isPending}
              className={`font-medium ${textNote.trim() && !createTextNoteMutation.isPending ? 'text-blue-500' : 'text-gray-300'}`}
            >
              {createTextNoteMutation.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>

          <div className="px-6">
            <div className="bg-gray-50 rounded-2xl p-4">
              <textarea
                value={textNote}
                onChange={(e) => setTextNote(e.target.value)}
                placeholder="Add measurements, ingredients, or cooking notes..."
                className="w-full bg-transparent text-gray-900 placeholder-gray-400 outline-none resize-none"
                rows={8}
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChefAudioApp;
