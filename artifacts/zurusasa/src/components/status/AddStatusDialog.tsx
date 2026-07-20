import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useHostStatuses, HostStatus } from "@/hooks/useHostStatuses";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  Type, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Loader2, 
  Clock, 
  Eye, 
  Upload 
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface AddStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Curated premium gradients
export const GRADIENT_PRESETS = [
  { name: "Sunset", value: "bg-gradient-to-tr from-[#FF512F] to-[#DD2476] text-white" },
  { name: "Deep Ocean", value: "bg-gradient-to-br from-[#00c6ff] to-[#0072ff] text-white" },
  { name: "Purple Rain", value: "bg-gradient-to-tr from-[#7F00FF] to-[#E100FF] text-white" },
  { name: "Emerald Dusk", value: "bg-gradient-to-br from-[#11998e] to-[#38ef7d] text-white" },
  { name: "Neon Dream", value: "bg-gradient-to-tr from-[#f857a6] to-[#ff5858] text-white" },
  { name: "Noir", value: "bg-gradient-to-b from-[#232526] to-[#414345] text-white border border-white/10" },
];

export function AddStatusDialog({ open, onOpenChange }: AddStatusDialogProps) {
  const { user } = useAuth();
  const hostId = user?.id || "";
  const { statuses, loading, addStatus, deleteStatus } = useHostStatuses([hostId]);
  
  const myStatuses = statuses[hostId] || [];

  const [activeTab, setActiveTab] = useState<string>("create");
  const [statusType, setStatusType] = useState<"text" | "media">("text");
  
  // Text Status Fields
  const [textContent, setTextContent] = useState("");
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0].value);
  
  // Media Status Fields
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear fields on open
  useEffect(() => {
    if (open) {
      setTextContent("");
      setMediaUrl("");
      setCaption("");
      setStatusType("text");
      setActiveTab(myStatuses.length > 0 ? "active" : "create");
    }
  }, [open, myStatuses.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (10MB for status)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Max limit is 10MB.");
      return;
    }

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isImage && !isVideo) {
      toast.error("Please upload an image or video file.");
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}/status_${crypto.randomUUID()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("reels")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("reels")
        .getPublicUrl(fileName);

      setMediaUrl(publicUrl);
      toast.success("Media uploaded successfully!");
    } catch (err: any) {
      console.error("Storage upload error:", err);
      toast.error(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (statusType === "text" && !textContent.trim()) {
      toast.error("Please enter some text for your status");
      return;
    }
    if (statusType === "media" && !mediaUrl) {
      toast.error("Please upload media or paste a URL");
      return;
    }

    try {
      setUploading(true);
      
      const mediaKind = statusType === "text" 
        ? "text" 
        : mediaUrl.toLowerCase().match(/\.(mp4|webm|mov|m4v)/) 
          ? "video" 
          : "image";

      await addStatus(mediaKind, {
        mediaUrl: statusType === "media" ? mediaUrl : undefined,
        textContent: statusType === "text" ? textContent : undefined,
        backgroundGradient: statusType === "text" ? selectedGradient : undefined,
        caption: statusType === "media" && caption ? caption : undefined,
      });

      onOpenChange(false);
    } catch (err) {
      // toast is already handled inside the hook
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this status? It will disappear for all users.")) {
      await deleteStatus(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border-border/40 bg-background shadow-2xl p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Host Status Manager
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-2xl mb-6">
            <TabsTrigger value="active" className="rounded-xl font-semibold text-xs py-2">
              Active Status ({myStatuses.length})
            </TabsTrigger>
            <TabsTrigger value="create" className="rounded-xl font-semibold text-xs py-2">
              Create Status
            </TabsTrigger>
          </TabsList>

          {/* Active Statuses List */}
          <TabsContent value="active" className="space-y-4 outline-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground">Loading statuses...</p>
              </div>
            ) : myStatuses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border/60 rounded-2xl p-6">
                <Clock className="h-10 w-10 mx-auto opacity-40 mb-3" />
                <p className="font-semibold text-sm">No active status</p>
                <p className="text-xs text-muted-foreground/80 mt-1 max-w-[80%] mx-auto">
                  Add a 24-hour status update to let guests know what is happening today!
                </p>
                <Button 
                  size="sm" 
                  className="mt-4 rounded-xl font-bold bg-primary" 
                  onClick={() => setActiveTab("create")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Status
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {myStatuses.map((status) => (
                  <div 
                    key={status.id} 
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Thumbnail Preview */}
                      <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
                        {status.mediaType === "text" ? (
                          <div className={`h-full w-full ${status.backgroundGradient} flex items-center justify-center text-[8px] font-bold p-1 line-clamp-2 leading-none text-center`}>
                            {status.textContent}
                          </div>
                        ) : status.mediaType === "video" ? (
                          <div className="relative h-full w-full">
                            <video src={status.mediaUrl} className="h-full w-full object-cover" muted playsInline />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <VideoIcon className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <img src={status.mediaUrl} alt="Status Preview" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold capitalize">
                          {status.mediaType === "text" ? "Text update" : status.mediaType + " status"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Shared {formatDistanceToNow(new Date(status.createdAt))} ago
                        </p>
                      </div>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(status.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Create Status Form */}
          <TabsContent value="create" className="space-y-6 outline-none">
            <form onSubmit={handlePublish} className="space-y-5">
              {/* Status Type Choice */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={statusType === "text" ? "default" : "outline"}
                  onClick={() => setStatusType("text")}
                  className="flex-1 rounded-xl font-bold gap-2 text-xs h-10"
                >
                  <Type className="h-4 w-4" />
                  Text Status
                </Button>
                <Button
                  type="button"
                  variant={statusType === "media" ? "default" : "outline"}
                  onClick={() => setStatusType("media")}
                  className="flex-1 rounded-xl font-bold gap-2 text-xs h-10"
                >
                  <ImageIcon className="h-4 w-4" />
                  Photo / Video
                </Button>
              </div>

              {/* Text Status Editor */}
              {statusType === "text" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="textContent" className="text-xs font-bold text-muted-foreground uppercase">
                      What is happening today?
                    </Label>
                    <Textarea
                      id="textContent"
                      placeholder="E.g., Perfect weather for a sunset dhow cruise today! ⛵ Slots available from 5 PM."
                      maxLength={180}
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="rounded-2xl border-border/50 min-h-[90px] focus-visible:ring-primary text-sm"
                    />
                    <div className="flex justify-end text-[10px] text-muted-foreground">
                      {textContent.length}/180
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">
                      Choose Background Gradient
                    </Label>
                    <div className="grid grid-cols-6 gap-2">
                      {GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setSelectedGradient(preset.value)}
                          title={preset.name}
                          className={`aspect-square rounded-xl ${preset.value} flex items-center justify-center border-2 transition-all hover:scale-105 active:scale-95 ${
                            selectedGradient === preset.value ? "border-primary scale-105 shadow-md shadow-primary/20" : "border-transparent"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Visual Preview */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Live Preview</Label>
                    <div className={`aspect-[9/16] max-w-[180px] mx-auto rounded-2xl ${selectedGradient} flex items-center justify-center p-4 text-center text-xs font-display font-bold shadow-lg leading-snug break-words overflow-hidden`}>
                      {textContent || "Status Preview Text"}
                    </div>
                  </div>
                </div>
              )}

              {/* Media Status Editor */}
              {statusType === "media" && (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Media File</Label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*,video/*"
                      className="hidden"
                    />
                    
                    {mediaUrl ? (
                      <div className="relative aspect-[9/16] max-w-[180px] mx-auto rounded-2xl bg-secondary overflow-hidden border border-border/40 shadow-lg group">
                        {mediaUrl.toLowerCase().match(/\.(mp4|webm|mov|m4v)/) ? (
                          <video src={mediaUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />
                        ) : (
                          <img src={mediaUrl} alt="Uploaded status" className="h-full w-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => setMediaUrl("")}
                          className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-black/80 transition-colors"
                        >
                          <Plus className="h-4 w-4 rotate-45" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-border/60 hover:border-primary/50 cursor-pointer rounded-2xl p-6 text-center space-y-2 hover:bg-muted/10 transition-colors"
                      >
                        {uploading ? (
                          <div className="space-y-2">
                            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                            <p className="text-xs text-muted-foreground">Uploading file...</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                            <p className="text-xs font-bold">Upload Photo or Video</p>
                            <p className="text-[10px] text-muted-foreground">Supports PNG, JPG, MP4, MOV (max 10MB)</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="caption" className="text-xs font-bold text-muted-foreground uppercase">Caption (Optional)</Label>
                    <Input
                      id="caption"
                      placeholder="Add a caption..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="rounded-xl border-border/50 focus-visible:ring-primary"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={uploading}
                className="w-full rounded-2xl h-12 font-bold text-sm bg-[#EE7D30] hover:bg-[#EE7D30]/90 text-white shadow-lg shadow-orange-500/10 mt-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  "Publish Daily Status"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
