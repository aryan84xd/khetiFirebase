import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Grid,
  Alert,
  CircularProgress,
  Typography,
  Box,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  doc,
  setDoc,
  updateDoc,
  where,
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import app from "../utils/firebase"; // make sure to export initialized firebase app

const db = getFirestore(app);
const auth = getAuth(app);

const CropPredictionForm = () => {
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]);
  const [formData, setFormData] = useState({
    N: "",
    P: "",
    K: "",
    temperature: "",
    humidity: "",
    ph: "",
    rainfall: "",
  });

  const [productionData, setProductionData] = useState({
    crop_name: "",
    production_value: "",
  });

  const [loading, setLoading] = useState(false);
  const [productionLoading, setProductionLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [productionError, setProductionError] = useState(null);
  const [productionSuccess, setProductionSuccess] = useState(null);

  const crops = [
    "apple",
    "banana",
    "blackgram",
    "chickpea",
    "coconut",
    "coffee",
    "cotton",
    "grapes",
    "jute",
    "kidneybeans",
    "lentil",
    "maize",
    "mango",
    "mothbeans",
    "mungbean",
    "muskmelon",
    "orange",
    "papaya",
    "pigeonpeas",
    "pomegranate",
    "rice",
    "watermelon",
  ];

  useEffect(() => {
    const fetchCropData = async () => {
      try {
        const q = query(collection(db, "crops"), orderBy("production", "desc"));
        const querySnapshot = await getDocs(q);
        const cropsData = querySnapshot.docs.map((doc) => doc.data());
        setData(cropsData);
      } catch (err) {
        console.error("Error fetching crops:", err);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    fetchCropData();

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: parseFloat(e.target.value),
    });
  };

  const handleProductionChange = (e) => {
    setProductionData({
      ...productionData,
      [e.target.name]:
        e.target.type === "number"
          ? parseFloat(e.target.value)
          : e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const predictResponse = await fetch(
        "http://localhost:5002/predict_crop",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const responseData = await predictResponse.json();

      if (!predictResponse.ok) {
        throw new Error(responseData.error || "Failed to predict crop");
      }

      setResult(responseData);
    } catch (err) {
      console.error("Error:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleProductionSubmit = async (e) => {
    e.preventDefault();
    setProductionLoading(true);
    setProductionError(null);
    setProductionSuccess(null);
  
    if (!user) {
      setProductionError("User not authenticated. Please log in.");
      setProductionLoading(false);
      return;
    }
  
    try {
      // 1. Add production entry to production_data
      await addDoc(collection(db, "production_data"), {
        user_id: user.uid,
        crop_name: productionData.crop_name,
        production_value: productionData.production_value,
        timestamp: new Date(),
      });
  
      // 2. Check if crop already exists
      const cropQuery = query(
        collection(db, "crops"),
        where("crop_name", "==", productionData.crop_name)
      );
      const cropSnapshot = await getDocs(cropQuery);
  
      if (!cropSnapshot.empty) {
        // 3. Crop exists, update its production
        const cropDoc = cropSnapshot.docs[0];
        const currentProduction = cropDoc.data().production || 0;
  
        await updateDoc(doc(db, "crops", cropDoc.id), {
          production: currentProduction + productionData.production_value,
        });
      } else {
        // 4. Crop doesn't exist, create new document with production
        const newDocRef = doc(collection(db, "crops"));
        await setDoc(newDocRef, {
          crop_name: productionData.crop_name,
          production: productionData.production_value,
        });
      }
  
      setProductionSuccess("Production data added and crop updated/created successfully!");
      setProductionData({ crop_name: "", production_value: "" });
    } catch (err) {
      console.error(err);
      setProductionError(err.message || "Failed to update production");
    } finally {
      setProductionLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, margin: "auto", p: 2 }}>
      {/* Prediction Card */}
      <Card elevation={3} sx={{ mb: 3 }}>
        <CardHeader
          title="Crop Prediction System"
          subheader="Enter soil and environmental parameters to get crop recommendations"
        />

        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nitrogen (N)"
                  name="N"
                  type="number"
                  inputProps={{ step: "0.01" }}
                  required
                  value={formData.N}
                  onChange={handleChange}
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phosphorus (P)"
                  name="P"
                  type="number"
                  inputProps={{ step: "0.01" }}
                  required
                  value={formData.P}
                  onChange={handleChange}
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Potassium (K)"
                  name="K"
                  type="number"
                  inputProps={{ step: "0.01" }}
                  required
                  value={formData.K}
                  onChange={handleChange}
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Temperature (°C)"
                  name="temperature"
                  type="number"
                  inputProps={{ step: "0.1" }}
                  required
                  value={formData.temperature}
                  onChange={handleChange}
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Humidity (%)"
                  name="humidity"
                  type="number"
                  inputProps={{ step: "0.1" }}
                  required
                  value={formData.humidity}
                  onChange={handleChange}
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="pH Level"
                  name="ph"
                  type="number"
                  inputProps={{ step: "0.1" }}
                  required
                  value={formData.ph}
                  onChange={handleChange}
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Rainfall (mm)"
                  name="rainfall"
                  type="number"
                  inputProps={{ step: "0.1" }}
                  required
                  value={formData.rainfall}
                  onChange={handleChange}
                  variant="outlined"
                />
              </Grid>
            </Grid>

            <CardActions sx={{ justifyContent: "flex-end", mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading}
                startIcon={loading && <CircularProgress size={20} />}
              >
                {loading ? "Predicting..." : "Predict Crop"}
              </Button>
            </CardActions>
          </form>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {result && (
            <Paper sx={{ mt: 3, p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Prediction Results
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Recommended Crop:</strong> {result.recommended_crop}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Probability:</strong>{" "}
                  {(result.probability * 100).toFixed(2)}%
                </Typography>
                <Typography variant="body1">
                  <strong>Production Value:</strong> {result.production_value}
                </Typography>
              </Box>
            </Paper>
          )}
        </CardContent>
      </Card>
      <Box sx={{ width: "100%", maxWidth: 600, margin: "auto", p: 2 }}>
        <Typography variant="h6" align="center" gutterBottom>
          Crop Production Indicator
        </Typography>
        {loading ? (
          <CircularProgress />
        ) : (
          <ResponsiveContainer width="100%" height={600}>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 20, left: 50, right: 20, bottom: 20 }}
              barCategoryGap={5}
            >
              <XAxis
                type="number"
                label={{
                  value: "Production (Metric Tons)",
                  position: "insideBottom",
                  dy: 10,
                }}
              />
              <YAxis
                dataKey="crop_name"
                type="category"
                width={120}
                tick={{ angle: -10, textAnchor: "end" }}
                interval={0}
              />
              <Tooltip formatter={(value) => `${value} Metric Tons`} />
              <Bar dataKey="production" fill="#3f51b5" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>

      {/* Production Input Card */}
      <Card elevation={3}>
        <CardHeader
          title="Add Production Value"
          subheader="Select crop and enter production value"
        />
        <CardContent>
          <form onSubmit={handleProductionSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel id="crop-select-label">Crop</InputLabel>
                  <Select
                    labelId="crop-select-label"
                    id="crop-select"
                    name="crop_name"
                    value={productionData.crop_name}
                    label="Crop"
                    onChange={handleProductionChange}
                  >
                    {crops.map((crop) => (
                      <MenuItem
                        key={crop}
                        value={crop}
                        sx={{ textTransform: "capitalize" }}
                      >
                        {crop.charAt(0).toUpperCase() + crop.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Production Value"
                  name="production_value"
                  type="number"
                  inputProps={{ step: "0.01" }}
                  required
                  value={productionData.production_value}
                  onChange={handleProductionChange}
                  variant="outlined"
                />
              </Grid>
            </Grid>
            <CardActions sx={{ justifyContent: "flex-end", mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={productionLoading}
                startIcon={productionLoading && <CircularProgress size={20} />}
              >
                {productionLoading ? "Submitting..." : "Submit Production"}
              </Button>
            </CardActions>
          </form>

          {productionError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {productionError}
            </Alert>
          )}

          {productionSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {productionSuccess}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default CropPredictionForm;
