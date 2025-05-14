import * as React from "react";
import { useEffect } from "react";
import dayjs from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,

  TextField,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { db, storage, auth } from "../utils/firebase"; // Import Firebase services
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
 
} from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import stateDistrictMap from "../components/statesWithDistricts";

export default function Search() {
  const [equipment, setEquipment] = React.useState([]);
  const [filteredEquipment, setFilteredEquipment] = React.useState([]);
  const [category, setCategory] = React.useState("");
  const [maxPrice, setMaxPrice] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [selectedEquipment, setSelectedEquipment] = React.useState(null);
  const [startDate, setStartDate] = React.useState(dayjs()); // Start date
  const [endDate, setEndDate] = React.useState(dayjs()); // End date
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [state, setState] = React.useState("");
  const [district, setDistrict] = React.useState("");
  const [districts, setDistricts] = React.useState([]); // Stores available districts for selected state

  // Function to get the image URL
  const getImageUrl = async (path) => {
    try {
      const imageRef = ref(storage, `${path}`);
      const url = await getDownloadURL(imageRef);
      return url;
    } catch (error) {
      console.error("Error downloading image:", error);
      return null;
    }
  };

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const equipmentRef = collection(db, "user_equipment");
        const equipmentQuery = query(
          equipmentRef,
          where("availability", "==", true),
          where("for_rent", "==", true)
        );
        
        const querySnapshot = await getDocs(equipmentQuery);
        const equipmentData = [];
        
        for (const doc of querySnapshot.docs) {
          const item = { id: doc.id, ...doc.data() };
          
          // Process image URLs
          const imageUrls = item.image_urls && item.image_urls.length > 0
            ? await Promise.all(item.image_urls.map(async (imagePath) => {
                return await getImageUrl(imagePath);
              }))
            : [];
            
          equipmentData.push({ ...item, image_urls: imageUrls });
        }
        
        setEquipment(equipmentData);
        setFilteredEquipment(equipmentData);
      } catch (error) {
        console.error("Error fetching equipment:", error);
      }
    };

    fetchEquipment();
  }, [refreshTrigger]);

  useEffect(() => {
    let filtered = [...equipment];
  
    if (category) {
      filtered = filtered.filter((item) => item.category === category);
    }
  
    if (maxPrice && !isNaN(maxPrice)) {
      filtered = filtered.filter(
        (item) => parseFloat(item.rental_price) <= parseFloat(maxPrice)
      );
    }
  
    if (state) {
      filtered = filtered.filter((item) => item.state_name === state);
    }
  
    if (district) {
      filtered = filtered.filter((item) => item.district_name === district);
    }
  
    setFilteredEquipment(filtered);
  }, [category, maxPrice, state, district, equipment]);

  const handleCategoryChange = (event) => {
    setCategory(event.target.value);
  };
  
  const handleMaxPriceChange = (event) => {
    setMaxPrice(event.target.value);
  };
  
  const handleStateChange = (event) => {
    const selectedState = event.target.value;
    setState(selectedState);
    setDistrict(""); // Reset district when state changes
    setDistricts(stateDistrictMap[selectedState] || []);
  };
  
  const handleDistrictChange = (event) => {
    setDistrict(event.target.value);
  };
  
  const handleOpenDialog = (item) => {
    setSelectedEquipment(item);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedEquipment(null);
  };
  
  const handleBooking = async () => {
    // Input validation checks
    if (!startDate || !endDate) {
      alert("Please select both start and end dates.");
      return;
    }

    if (endDate.isBefore(startDate)) {
      alert("End date cannot be before start date.");
      return;
    }

    if (startDate.isBefore(dayjs(), "day")) {
      alert("Cannot book equipment for past dates.");
      return;
    }

    if (!selectedEquipment) {
      alert("No equipment selected.");
      return;
    }

    try {
      // Check if user is logged in
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        alert("Please login to book equipment.");
        return;
      }

      // const userId = currentUser.uid;
      const numberOfDays = endDate.diff(startDate, "day") + 1;
      const totalCost = parseFloat(selectedEquipment.rental_price) * numberOfDays;

      // First, check if the equipment is still available
      const equipmentDocRef = doc(db, "user_equipment", selectedEquipment.id);
      const equipmentSnapshot = await getDoc(equipmentDocRef);
      
      if (!equipmentSnapshot.exists()) {
        alert("Equipment not found.");
        return;
      }
      
      const equipmentData = equipmentSnapshot.data();
      
      if (!equipmentData.availability) {
        alert("Sorry, this equipment is no longer available.");
        return;
      }

      // Update equipment availability
      await updateDoc(equipmentDocRef, { 
        availability: false 
      });
      
      // Verify the update was successful
      const verifySnapshot = await getDoc(equipmentDocRef);
      const verifiedData = verifySnapshot.data();
      
      if (verifiedData.availability !== false) {
        throw new Error("Failed to verify equipment availability update");
      }

      Create the booking
      const bookingRef = collection(db, "bookings");
      const newBooking = await addDoc(bookingRef, {
        equipment_id: selectedEquipment.id,
        user_id: userId,
        owner_id: selectedEquipment.user_id,
        start_date: Timestamp.fromDate(startDate.toDate()),
        end_date: Timestamp.fromDate(endDate.toDate()),
        cost: totalCost,
        status: "rented",
        created_at: Timestamp.now()
      });

      alert(`Booking successful! Total cost: ₹${totalCost}`);
      handleClose();

      // Update local state
      setFilteredEquipment((prev) =>
        prev.filter((item) => item.id !== selectedEquipment.id)
      );
      setEquipment((prev) =>
        prev.filter((item) => item.id !== selectedEquipment.id)
      );

      // Trigger a refresh of the equipment list
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error in booking process:", error);
      
      // If there was an error, attempt to revert the availability status
      if (selectedEquipment) {
        try {
          const equipmentDocRef = doc(db, "user_equipment", selectedEquipment.id);
          await updateDoc(equipmentDocRef, { availability: true });
        } catch (revertError) {
          console.error("Error reverting availability:", revertError);
        }
      }
      
      alert(error.message || "An error occurred during booking. Please try again.");
    }
  };

  const calculatedCost = React.useMemo(() => {
    if (!selectedEquipment || !startDate || !endDate) return null;
    if (endDate.isBefore(startDate)) return null;

    const days = endDate.diff(startDate, "day") + 1;
    return (parseFloat(selectedEquipment.rental_price) * days).toFixed(2);
  }, [selectedEquipment, startDate, endDate]);

  const renderCostPreview = () => {
    if (!calculatedCost) return null;

    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: "bold" }}>
          Booking Summary:
        </Typography>
        <Typography variant="body2">
          Duration: {endDate.diff(startDate, "day") + 1} days
        </Typography>
        <Typography variant="body2" color="primary" sx={{ fontWeight: "bold" }}>
          Total Cost: ₹{calculatedCost}
        </Typography>
      </Box>
    );
  };
  return (
    <Container maxWidth="lg">
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ fontWeight: "bold", color: "#3f51b5" }}
      >
        Search Equipment
      </Typography>
      <Box sx={{ display: "flex", gap: 2, marginBottom: 4 }}>
        <TextField
          select
          label="Category"
          value={category}
          onChange={handleCategoryChange}
          fullWidth
        >
          <MenuItem value="">All Categories</MenuItem>
          <MenuItem value="" disabled>
            Select a Category
          </MenuItem>
          <MenuItem value="Harvester">Harvester</MenuItem>
          <MenuItem value="Ploughs">Ploughs</MenuItem>
          <MenuItem value="Harrows">Harrows</MenuItem>
          <MenuItem value="Rotavators">Rotavators</MenuItem>
          <MenuItem value="Seed Drills">Seed Drills</MenuItem>
          <MenuItem value="Transplanters">Transplanters</MenuItem>
          <MenuItem value="Sprinkler Systems">Sprinkler Systems</MenuItem>
          <MenuItem value="Drip Irrigation Systems">
            Drip Irrigation Systems
          </MenuItem>
          <MenuItem value="Combine Harvesters">Combine Harvesters</MenuItem>
          <MenuItem value="Threshers">Threshers</MenuItem>
          <MenuItem value="Sickle and Scythe">Sickle and Scythe</MenuItem>
          <MenuItem value="Sprayers">Sprayers</MenuItem>
          <MenuItem value="Dusters">Dusters</MenuItem>
          <MenuItem value="Grain Dryers">Grain Dryers</MenuItem>
          <MenuItem value="Chaff Cutters">Chaff Cutters</MenuItem>
          <MenuItem value="Trailers">Trailers</MenuItem>
          <MenuItem value="Tractors">Tractors</MenuItem>
          <MenuItem value="Power Tillers">Power Tillers</MenuItem>
          <MenuItem value="Sugarcane Harvesters">Sugarcane Harvesters</MenuItem>
          <MenuItem value="Rice Combine Harvesters">
            Rice Combine Harvesters
          </MenuItem>
          {/* Add more categories as needed */}
        </TextField>

        <TextField
          label="Max Price"
          type="number"
          value={maxPrice}
          onChange={handleMaxPriceChange}
          fullWidth
        />
      </Box>
      <Box sx={{ display: "flex", gap: 2, marginBottom: 4 }}>
      <TextField
        select
        label="State"
        value={state}
        onChange={handleStateChange}
        fullWidth
      >
        <MenuItem value="">Select State</MenuItem>
        {Object.keys(stateDistrictMap).map((stateName) => (
          <MenuItem key={stateName} value={stateName}>
            {stateName}
          </MenuItem>
        ))}
      </TextField>

      {/* District Dropdown */}
      <TextField
        select
        label="District"
        value={district}
        onChange={handleDistrictChange}
        fullWidth
        disabled={!state}  // Disable district dropdown if state is not selected
      >
        <MenuItem value="">Select District</MenuItem>
        {districts.map((dist) => (
          <MenuItem key={dist} value={dist}>
            {dist}
          </MenuItem>
        ))}
      </TextField>
    </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 4,
          margin: {
            xs: "16px", // Extra small screens
            sm: "24px", // Small screens
            md: "32px", // Medium screens
            lg: "48px", // Large screens
          },
          padding: "16px", // Added padding to help visualize space
        }}
      >
        {filteredEquipment.map((item) => (
          <Box item key={item.id} xs={12} sm={6} md={4}>
            <Card sx={{ boxShadow: 3, borderRadius: 2 }}>
              {item.image_urls && item.image_urls.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    overflowX: "scroll",
                    paddingBottom: 2,
                    "&::-webkit-scrollbar": { height: "8px" },
                    "&::-webkit-scrollbar-thumb": { backgroundColor: "#888" },
                    "&::-webkit-scrollbar-thumb:hover": {
                      backgroundColor: "#555",
                    },
                  }}
                >
                  {item.image_urls.map((url, index) => (
                    <CardMedia
                      key={index}
                      component="img"
                      height="180"
                      image={url}
                      alt={item.name}
                      sx={{
                        minWidth: 300,
                        borderRadius: 1,
                        marginRight: 2,
                        "&:hover": {
                          transform: "scale(1.05)",
                          transition: "transform 0.3s ease",
                        },
                      }}
                    />
                  ))}
                </Box>
              )}
              <CardContent>
                <Typography
                  gutterBottom
                  variant="h5"
                  component="div"
                  sx={{ fontWeight: "bold" }}
                >
                  {item.brand} {item.model}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Category:{" "}
                  <span style={{ fontWeight: "normal" }}>{item.category}</span>
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  Rental Price:{" "}
                  <span style={{ fontWeight: "normal" }}>
                    ₹{item.rental_price}
                  </span>
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  District:{" "}
                  <span style={{ fontWeight: "normal" }}>
                    {item?.district_name || "NA"}
                  </span>
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: "bold" }}
                >
                  State:{" "}
                  <span style={{ fontWeight: "normal" }}>
                    {item?.state_name || "NA"}
                  </span>
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: "center" }}>
                <Button
                  size="small"
                  color="primary"
                  variant="contained"
                  onClick={() => handleOpenDialog(item)} // Open dialog for selected equipment
                >
                  View
                </Button>
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Dialog for Viewing and Booking */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            fontWeight: "bold",
            fontSize: "1.5rem",
            color: "#3f51b5",
            textAlign: "center",
          }}
        >
          {selectedEquipment?.brand} {selectedEquipment?.model}
        </DialogTitle>
        <DialogContent>
          {/* Scrollable Image Gallery */}
          {selectedEquipment?.image_urls &&
            selectedEquipment.image_urls.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  overflowX: "scroll",
                  marginBottom: 2,
                  "&::-webkit-scrollbar": { height: "8px" },
                  "&::-webkit-scrollbar-thumb": { backgroundColor: "#888" },
                  "&::-webkit-scrollbar-thumb:hover": {
                    backgroundColor: "#555",
                  },
                }}
              >
                {selectedEquipment.image_urls.map((url, index) => (
                  <CardMedia
                    key={index}
                    component="img"
                    height="200"
                    image={url}
                    alt={selectedEquipment.name}
                    sx={{
                      borderRadius: 2,
                      marginRight: 2,
                      boxShadow: 2,
                      "&:hover": {
                        transform: "scale(1.05)",
                        transition: "transform 0.3s ease",
                      },
                    }}
                  />
                ))}
              </Box>
            )}

          {/* Equipment Details */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              padding: 2,
              backgroundColor: "#f9f9f9",
              borderRadius: 2,
              boxShadow: 2,
            }}
          >
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Description:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.description || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Category:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.category || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Rental Price:{" "}
              <span style={{ fontWeight: "normal" }}>
                ₹{selectedEquipment?.rental_price || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Landmark:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.location || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Village:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.village_name || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              District:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.district_name || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              State:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedEquipment?.state_name || "N/A"}
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                marginBottom: 0.5,
              }}
            >
              Rent:{" "}
              <span style={{ fontWeight: "normal" }}>
                ₹{selectedEquipment?.rental_price} per day
              </span>
            </Typography>

            {/* Date Pickers for Start and End Date */}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
                minDate={dayjs()} // Prevent selecting past dates
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
                minDate={startDate} // Prevent selecting end date before start date
              />
            </LocalizationProvider>
          </Box>
        </DialogContent>
        {renderCostPreview()}
        <DialogActions>
          <Button onClick={handleClose} color="secondary">
            Close
          </Button>
          <Button onClick={handleBooking} color="primary" variant="contained">
            Book Equipment
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
