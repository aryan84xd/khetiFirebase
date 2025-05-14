import React, { useState, useEffect,useCallback } from "react";
import {
  TextField,
  Button,
  Typography,
  Container,
  Box,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
  Grid,
  CardActions,
  Divider,
  Avatar,
} from "@mui/material";
// import { db, storage, auth } from "../utils/firebase";
import {
  Close as CloseIcon,
  Image as ImageIcon,
  Send as SendIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Article as ArticleIcon,
} from "@mui/icons-material";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  serverTimestamp, 
  query, 
  orderBy 
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";

export default function BlogPage() {
  const [blogs, setBlogs] = useState([]);
  const [blog, setBlog] = useState({ title: "", content: "" });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Firebase services
  const auth = getAuth();
  const db = getFirestore();
  const storage = getStorage();

  const fetchBlogs = useCallback(async () => {
    try {
      const blogsQuery = query(collection(db, "blogs"), orderBy("created_at", "desc"));
      const querySnapshot = await getDocs(blogsQuery);
      
      const blogsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setBlogs(blogsData);
    } catch (error) {
      console.error("Error fetching blogs:", error);
    }
  }, [db]);

  useEffect(() => {
    fetchBlogs();
    
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, [auth, fetchBlogs]);

  const handleChange = (e) => {
    setBlog({ ...blog, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    setImages([...e.target.files]);
  };

  const handleImageUpload = async (image, userId, title) => {
    try {
      const filePath = `blogs/${userId}/${title}/${image.name}`;
      const storageRef = ref(storage, filePath);
      
      await uploadBytes(storageRef, image);
      const downloadURL = await getDownloadURL(storageRef);
      
      return { path: filePath, url: downloadURL };
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const sendToFlaskAPI = async (title, content) => {
    try {
      const response = await fetch('https://khetifirebase-88g2.onrender.com/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `Title: ${title}\nDescription: ${content}`, // Format the text as required
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Successfully sent to Flask API:', data);
    } catch (error) {
      console.error('Error sending to Flask API:', error);
      alert('Note: Blog was saved but there was an error updating the vector store.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("You need to be logged in to post a blog.");
      return;
    }
    setLoading(true);
    const imageData = [];

    try {
      // Handle image uploads
      for (const image of images) {
        const imageInfo = await handleImageUpload(image, user.uid, blog.title);
        if (imageInfo) imageData.push(imageInfo);
      }

      // Insert blog into Firestore
      await addDoc(collection(db, "blogs"), {
        title: blog.title,
        content: blog.content,
        user_id: user.uid,
        author_name: user.displayName || "Anonymous",
        image_data: imageData,
        created_at: serverTimestamp()
      });

      // If Firestore insert was successful, send to Flask API
      await sendToFlaskAPI(blog.title, blog.content);

      alert("Blog posted successfully!");
      setBlog({ title: "", content: "" });
      setImages([]);
      fetchBlogs();
    } catch (error) {
      console.error(error);
      alert("Failed to post blog.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBlog = (blog) => {
    setSelectedBlog(blog);
    setOpenDialog(true);
  };

  const handleNextImage = () => {
    if (selectedBlog?.image_data?.length > 1) {
      setCurrentImageIndex((prev) => 
        prev === selectedBlog.image_data.length - 1 ? 0 : prev + 1
      );
    }
  };

  const handlePrevImage = () => {
    if (selectedBlog?.image_data?.length > 1) {
      setCurrentImageIndex((prev) => 
        prev === 0 ? selectedBlog.image_data.length - 1 : prev - 1
      );
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 6 }}>
        {/* Create Blog Section */}
        <Paper elevation={3} sx={{ p: 4, mb: 6, borderRadius: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
            Create a Blog Post
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              margin="normal"
              label="Title"
              name="title"
              value={blog.title}
              onChange={handleChange}
              required
              variant="outlined"
              sx={{ mb: 3 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Content"
              name="content"
              multiline
              rows={6}
              value={blog.content}
              onChange={handleChange}
              required
              variant="outlined"
              sx={{ mb: 3 }}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  startIcon={<ImageIcon />}
                  sx={{ height: 56 }}
                >
                  Upload Images
                  <input type="file" hidden multiple onChange={handleImageChange} />
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                  sx={{ height: 56 }}
                >
                  {loading ? "Posting..." : "Post Blog"}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>

        {/* Blogs List Section */}
        <Typography variant="h4" sx={{ mb: 4 }}>
          Recent Blogs
        </Typography>
        <Grid container spacing={4}>
          {blogs.map((blog) => (
            <Grid item xs={12} sm={6} md={4} key={blog.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6,
                  }
                }}
              >
                <Box 
                  sx={{ 
                    position: 'relative', 
                    height: 200,
                    bgcolor: 'grey.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {!blog.image_data?.length ? (
                    <ArticleIcon sx={{ fontSize: 60, color: 'grey.300' }} />
                  ) : (
                    <CardMedia
                      component="img"
                      height="200"
                      image={blog.image_data[0].url}
                      alt={blog.title}
                      sx={{ 
                        objectFit: "cover",
                        height: '100%',
                        width: '100%'
                      }}
                    />
                  )}
                  {blog.image_data?.length > 1 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        bgcolor: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        px: 1,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                      }}
                    >
                      +{blog.image_data.length - 1} more
                    </Box>
                  )}
                </Box>
                <CardContent sx={{ flexGrow: 1, pt: 2 }}>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {blog.title}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {blog.content}
                  </Typography>
                </CardContent>
                <Divider />
                <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar
                      sx={{ width: 24, height: 24, mr: 1 }}
                      alt={blog.author_name}
                      src="/placeholder-avatar.jpg"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {blog.author_name || "Anonymous"}
                    </Typography>
                  </Box>
                  <Button 
                    size="small" 
                    color="primary"
                    onClick={() => handleOpenBlog(blog)}
                  >
                    Read More
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Blog Dialog */}
        <Dialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setCurrentImageIndex(0);
          }}
          maxWidth="md"
          fullWidth
        >
          {selectedBlog && (
            <>
              <DialogTitle sx={{ pr: 6 }}>
                {selectedBlog.title}
                <IconButton
                  onClick={() => {
                    setOpenDialog(false);
                    setCurrentImageIndex(0);
                  }}
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers>
                {selectedBlog.image_data?.length > 0 ? (
                  <Box sx={{ position: 'relative', mb: 3 }}>
                    <Box
                      sx={{
                        position: 'relative',
                        height: { xs: 250, sm: 400 },
                        width: '100%',
                        overflow: 'hidden',
                        borderRadius: 1,
                        bgcolor: 'grey.100',
                      }}
                    >
                      <img
                        src={selectedBlog.image_data[currentImageIndex].url}
                        alt={`Blog ${currentImageIndex + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                      />
                      {selectedBlog.image_data.length > 1 && (
                        <>
                          <IconButton
                            onClick={handlePrevImage}
                            sx={{
                              position: 'absolute',
                              left: 8,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              bgcolor: 'rgba(255, 255, 255, 0.8)',
                              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' },
                            }}
                          >
                            <ChevronLeftIcon />
                          </IconButton>
                          <IconButton
                            onClick={handleNextImage}
                            sx={{
                              position: 'absolute',
                              right: 8,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              bgcolor: 'rgba(255, 255, 255, 0.8)',
                              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' },
                            }}
                          >
                            <ChevronRightIcon />
                          </IconButton>
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 8,
                              right: 8,
                              bgcolor: 'rgba(0, 0, 0, 0.6)',
                              color: 'white',
                              px: 1,
                              borderRadius: 1,
                              fontSize: '0.875rem',
                            }}
                          >
                            {currentImageIndex + 1} / {selectedBlog.image_data.length}
                          </Box>
                        </>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      height: { xs: 200, sm: 300 },
                      bgcolor: 'grey.100',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      borderRadius: 1,
                    }}
                  >
                    <ArticleIcon sx={{ fontSize: 80, color: 'grey.300' }} />
                  </Box>
                )}
                <Typography variant="body1" paragraph>
                  {selectedBlog.content}
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                  <Avatar
                    sx={{ width: 32, height: 32, mr: 1 }}
                    alt={selectedBlog.author_name}
                    src="/placeholder-avatar.jpg"
                  />
                  <Box>
                    <Typography variant="subtitle2">
                      {selectedBlog.author_name || "Anonymous"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Posted on {selectedBlog.created_at?.toDate().toLocaleString() || "Unknown date"}
                    </Typography>
                  </Box>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => {
                  setOpenDialog(false);
                  setCurrentImageIndex(0);
                }}>
                  Close
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </Container>
  );
}
