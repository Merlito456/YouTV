import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Channel, Program } from '../types';
import { Plus, Trash2, Edit2, X, Save, Lock, Calendar, Video, List, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChannel, setEditingChannel] = useState<Partial<Channel> | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [managingPrograms, setManagingPrograms] = useState<Channel | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [editingProgram, setEditingProgram] = useState<Partial<Program> | null>(null);
  const [isBatchAdding, setIsBatchAdding] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setChannels(data);
    }
    setLoading(false);
  };

  const handleSaveChannel = async (channel: Partial<Channel>) => {
    if (channel.id) {
      const { error } = await supabase
        .from('channels')
        .update(channel)
        .eq('id', channel.id);
      if (!error) fetchChannels();
    } else {
      const { error } = await supabase
        .from('channels')
        .insert([channel]);
      if (!error) fetchChannels();
    }
    setEditingChannel(null);
    setIsAdding(false);
  };

  const handleDeleteChannel = async (id: string) => {
    if (confirm('Are you sure you want to delete this channel?')) {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', id);
      if (!error) fetchChannels();
    }
  };

  const fetchPrograms = async (channelId: string) => {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('channel_id', channelId)
      .order('start_time', { ascending: true });

    if (!error && data) {
      setPrograms(data);
    }
  };

  const handleSaveProgram = async (program: Partial<Program>) => {
    if (!managingPrograms) return;
    
    const programData = {
      ...program,
      channel_id: managingPrograms.id
    };

    if (program.id) {
      const { error } = await supabase
        .from('programs')
        .update(programData)
        .eq('id', program.id);
      if (error) {
        console.error('Error updating program:', error);
        alert(`Failed to update video: ${error.message}`);
      } else {
        fetchPrograms(managingPrograms.id);
        setEditingProgram(null);
      }
    } else {
      const { error } = await supabase
        .from('programs')
        .insert([programData]);
      if (error) {
        console.error('Error inserting program:', error);
        alert(`Failed to save video: ${error.message}\n\nMake sure the "programs" table has a "video_id" column.`);
      } else {
        fetchPrograms(managingPrograms.id);
        setEditingProgram(null);
      }
    }
  };

  const handleBatchAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!managingPrograms) return;

    const formData = new FormData(e.currentTarget);
    const rawLinks = formData.get('links') as string;
    const startTimeStr = formData.get('start_time') as string;
    const durationMins = parseInt(formData.get('duration') as string);

    if (isNaN(durationMins) || durationMins <= 0) {
      alert('Please enter a valid duration in minutes.');
      return;
    }

    const videoIds = rawLinks
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        
        // Robust YouTube ID extraction
        // Matches: dQw4w9WgXcQ, https://www.youtube.com/watch?v=dQw4w9WgXcQ, https://youtu.be/dQw4w9WgXcQ, etc.
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = trimmed.match(regex);
        
        if (match) return match[1];
        if (trimmed.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
        return null;
      })
      .filter(id => id !== null) as string[];

    if (videoIds.length === 0) {
      alert('No valid YouTube video IDs found in the input.');
      return;
    }

    let currentStartTime = new Date(startTimeStr);
    const newPrograms = videoIds.map((id, index) => {
      const start = new Date(currentStartTime);
      const end = new Date(currentStartTime.getTime() + durationMins * 60000);
      currentStartTime = new Date(end); // Next one starts when this one ends

      return {
        channel_id: managingPrograms.id,
        title: `Program ${index + 1}`,
        video_id: id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        description: `Batch added video ${index + 1}`
      };
    });

    console.log('Inserting batch programs:', newPrograms);

    const { error } = await supabase.from('programs').insert(newPrograms);
    
    if (error) {
      console.error('Error saving batch programs:', error);
      alert(`Failed to save videos: ${error.message}\n\nMake sure the "programs" table has a "video_id" column.`);
    } else {
      fetchPrograms(managingPrograms.id);
      setIsBatchAdding(false);
      alert(`Successfully added ${newPrograms.length} videos!`);
    }
  };

  const handleDeleteProgram = async (id: string) => {
    if (confirm('Delete this program/video link?')) {
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', id);
      if (!error && managingPrograms) fetchPrograms(managingPrograms.id);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Lock className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">YOUTV Admin Panel</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Channels List</h3>
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-lg shadow-indigo-600/20 font-medium"
            >
              <Plus className="w-4 h-4" /> Add Channel
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <div className="grid gap-4">
              {channels.map(channel => (
                <div key={channel.id} className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl flex items-center justify-between group hover:border-zinc-600 transition-all">
                  <div className="flex-1">
                    <h4 className="font-bold text-white">{channel.name}</h4>
                    <div className="flex gap-4 mt-1">
                      <p className="text-xs text-zinc-500">
                        {channel.is_live ? 'Live Stream' : channel.playlist_id ? 'Playlist' : 'Search Query'}
                      </p>
                      {channel.username && <p className="text-xs text-indigo-400">@{channel.username}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setManagingPrograms(channel);
                        fetchPrograms(channel.id);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-xs transition-colors"
                    >
                      <Calendar className="w-3 h-3" /> Manage Videos
                    </button>
                    <button 
                      onClick={() => setEditingChannel(channel)}
                      className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-indigo-400 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteChannel(channel.id)}
                      className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Channel Edit Modal */}
      <AnimatePresence>
        {(isAdding || editingChannel) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          >
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-white mb-6">
                {isAdding ? 'Add New Channel' : 'Edit Channel'}
              </h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = Object.fromEntries(formData.entries());
                handleSaveChannel({
                  ...editingChannel,
                  name: data.name as string,
                  query: data.query as string,
                  playlist_id: data.playlist_id as string,
                  username: data.username as string,
                  channel_id: data.channel_id as string,
                  live_video_id: data.live_video_id as string,
                  is_live: data.is_live === 'on',
                });
              }} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Channel Name</label>
                  <input name="name" defaultValue={editingChannel?.name} required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Username</label>
                    <input name="username" defaultValue={editingChannel?.username} placeholder="e.g. tech_tv" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">YT Channel ID</label>
                    <input name="channel_id" defaultValue={editingChannel?.channel_id} placeholder="UC..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <input type="checkbox" name="is_live" id="is_live" defaultChecked={editingChannel?.is_live} className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500" />
                  <label htmlFor="is_live" className="text-sm text-zinc-300">Is Live Stream?</label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Live Video ID</label>
                  <input name="live_video_id" defaultValue={editingChannel?.live_video_id} placeholder="e.g. jfKfPfyJRdk" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Playlist ID</label>
                  <input name="playlist_id" defaultValue={editingChannel?.playlist_id} placeholder="e.g. PL..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Search Query</label>
                  <input name="query" defaultValue={editingChannel?.query} placeholder="e.g. lofi hip hop" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex gap-3 mt-8">
                  <button type="button" onClick={() => { setIsAdding(false); setEditingChannel(null); }} className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">Save Channel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Programs Management Modal */}
      <AnimatePresence>
        {managingPrograms && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          >
            <div className="w-full max-w-5xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Manage Videos: {managingPrograms.name}</h3>
                  <p className="text-sm text-zinc-500">Add unlimited video links as scheduled programs</p>
                </div>
                <button onClick={() => setManagingPrograms(null)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex gap-6">
                {/* Programs List */}
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Scheduled Videos</h4>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsBatchAdding(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        <Layers className="w-3 h-3" /> Batch Add
                      </button>
                      <button 
                        onClick={() => setEditingProgram({})}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        <Plus className="w-3 h-3" /> Add Video
                      </button>
                    </div>
                  </div>
                  
                  {programs.length === 0 ? (
                    <div className="text-center py-20 bg-zinc-800/20 rounded-2xl border border-dashed border-zinc-700">
                      <Video className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                      <p className="text-zinc-500">No videos scheduled yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {programs.map(p => (
                        <div key={p.id} className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl flex items-center justify-between group">
                          <div>
                            <h5 className="font-bold text-white text-sm">{p.title}</h5>
                            <p className="text-[10px] text-zinc-500 font-mono mt-1">
                              {new Date(p.start_time).toLocaleTimeString()} - {new Date(p.end_time).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingProgram(p)} className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-indigo-400"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => handleDeleteProgram(p.id)} className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Program Form */}
                <AnimatePresence>
                  {editingProgram && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="w-80 bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 h-fit"
                    >
                      <h4 className="font-bold text-white mb-4">{editingProgram.id ? 'Edit Video' : 'Add Video'}</h4>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const data = Object.fromEntries(formData.entries());
                        handleSaveProgram({
                          ...editingProgram,
                          title: data.title as string,
                          video_id: data.video_id as string,
                          description: data.description as string,
                          start_time: data.start_time as string,
                          end_time: data.end_time as string,
                        });
                      }} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Title</label>
                          <input name="title" defaultValue={editingProgram.title} required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">YouTube Video ID</label>
                          <input name="video_id" defaultValue={editingProgram.video_id} required placeholder="e.g. dQw4w9WgXcQ" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Start Time</label>
                            <input type="datetime-local" name="start_time" defaultValue={editingProgram.start_time ? new Date(editingProgram.start_time).toISOString().slice(0, 16) : ''} required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-white text-[10px] focus:ring-2 focus:ring-indigo-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">End Time</label>
                            <input type="datetime-local" name="end_time" defaultValue={editingProgram.end_time ? new Date(editingProgram.end_time).toISOString().slice(0, 16) : ''} required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-white text-[10px] focus:ring-2 focus:ring-indigo-500 outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Description</label>
                          <textarea name="description" defaultValue={editingProgram.description} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none" />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => setEditingProgram(null)} className="flex-1 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold">Cancel</button>
                          <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">Save</button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Batch Add Form */}
                <AnimatePresence>
                  {isBatchAdding && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="w-96 bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 h-fit"
                    >
                      <h4 className="font-bold text-white mb-4">Batch Add Videos</h4>
                      <form onSubmit={handleBatchAdd} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">YouTube Links / IDs (one per line)</label>
                          <textarea 
                            name="links" 
                            required 
                            placeholder="https://youtube.com/watch?v=...&#10;jfKfPfyJRdk"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none h-40 resize-none font-mono" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Start From</label>
                            <input 
                              type="datetime-local" 
                              name="start_time" 
                              required 
                              defaultValue={new Date().toISOString().slice(0, 16)}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-white text-[10px] focus:ring-2 focus:ring-indigo-500 outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Duration (mins)</label>
                            <input 
                              type="number" 
                              name="duration" 
                              required 
                              defaultValue="30"
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => setIsBatchAdding(false)} className="flex-1 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold">Cancel</button>
                          <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">Add Batch</button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
