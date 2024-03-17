import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import hand_landmarker_task from "./hand_landmarker.task";

import './App-light.css';


const WebcamDisplay = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const scribbleCanvasRef = useRef(null);
    const [handPresence, setHandPresence] = useState(null);
    const [recordedPoints, setRecordedPoints] = useState([]);
    
    const [imageUrls, setImageUrls] = useState([]); // Holds the URLs of the generated images

    const [generateBtnText, setGenerateBtnText] = useState("Generate");
    const [prompt, setPrompt] = useState("");

    const [numImages, setNumImages] = useState(3);
    const [imageResolution, setImageResolution] = useState(512);
    const [numSteps, setNumSteps] = useState(25);
    const [seed, setSeed] = useState(42);
    const [randomSeed, setRandomSeed] = useState(false);

    const [additionalPrompt, setAdditionalPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [promptGuidance, setPromptGuidance] = useState(15);

    const resetStates = () => {
        setRecordedPoints([]);
        setImageUrls([]); 
        setPrompt('')
        setNumImages(3);
        setImageResolution(512);
        setNumSteps(25);
        setSeed(42);
        setRandomSeed(false);
        setAdditionalPrompt('');
        setNegativePrompt('');
        setPromptGuidance(15);
        setRecordedPoints([]);
        drawScribble([]); 
        setGenerateBtnText("Generate")
    };

    const screenWidth = window.innerWidth; 
    let imagesPerRow;
    if (screenWidth <= 600) {
        imagesPerRow = 2;
    } else if (screenWidth > 600 && screenWidth <= 900) {
        imagesPerRow = 3;
    } else {
        imagesPerRow = 4;
    }
    const imageWidthPercentage = 100 / imagesPerRow;
    
    useEffect(() => {
        let handLandmarker;
        let animationFrameId;

        const initializeHandDetection = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
                );
                handLandmarker = await HandLandmarker.createFromOptions(
                    vision, {
                        baseOptions: { modelAssetPath: hand_landmarker_task },
                        numHands: 2,
                        runningMode: "video"
                    }
                );
                detectHands();
            } catch (error) {
                console.error("Error initializing hand detection:", error);
            }
        };

        const drawLandmarks = (landmarksArray) => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';

            landmarksArray.forEach(landmarks => {
                landmarks.forEach(landmark => {
                    const x = landmark.x * canvas.width;
                    const y = landmark.y * canvas.height;

                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, 2 * Math.PI); // Draw a circle for each landmark
                    ctx.fill();
                });
            });
        };

        const recordPoint = (handdnessArray, landmarksArray) => {
            //console.log(handdnessArray);
            // Find the index of the right hand and record the landmark at index 8 (tip of the index finger)
            let rightHandIndex = -1;
            handdnessArray.forEach((handedness, hand_idx) => {
                if (handedness[0].categoryName == "Right") {
                    rightHandIndex = hand_idx;
                }
            });
            //console.log(rightHandIndex);
            if (rightHandIndex > -1) {
                const rightHandLandmark8 = landmarksArray[rightHandIndex][8];
                // append the recorded point to the recordedPoints array
                setRecordedPoints(recordedPoints => [...recordedPoints, rightHandLandmark8]);
            }   
        };

        const detectHands = () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
                const detections = handLandmarker.detectForVideo(videoRef.current, performance.now());
                setHandPresence(detections.handednesses.length > 0);

                // Assuming detections.landmarks is an array of landmark objects
                if (detections.landmarks) {
                    drawLandmarks(detections.landmarks);
                    recordPoint(detections.handednesses, detections.landmarks);
                }
            }
            requestAnimationFrame(detectHands);
        };


        const startWebcam = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoRef.current.srcObject = stream;
                // make the video and canvas the same size as the video stream
                const w = stream.getVideoTracks()[0].getSettings().width;
                const h = stream.getVideoTracks()[0].getSettings().height;
                videoRef.current.width = w;
                videoRef.current.height = h;
                canvasRef.current.width = w;
                canvasRef.current.height = h;
                scribbleCanvasRef.current.width = w;
                scribbleCanvasRef.current.height = h;
                await initializeHandDetection();
            } catch (error) {
                console.error("Error accessing webcam:", error);
            }
        };

        startWebcam();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            if (handLandmarker) {
                handLandmarker.close();
            }
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, []);

    const drawScribble = (pointsArray) => {
        const canvas = scribbleCanvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "blue";
        ctx.lineWidth = 1;
        ctx.beginPath();

        let firstPoint = true;  // Flag to indicate if this is the first point in the array
        //console.log(pointsArray);
        pointsArray.forEach(landmark => {
            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            };
        });
        
        ctx.stroke();
    };

    const saveScribble = () =>{
        var canvas = scribbleCanvasRef.current;
        var dataURL = canvas.toDataURL("image/png");
        //var newTab = window.open('about:blank','image from canvas');
        //newTab.document.write("<img src='" + dataURL + "' alt='from canvas'/>");
        setImageUrl(dataURL);
        console.log(dataURL)
    };

    useEffect(() => {
        // This effect will run whenever recordedPoints state changes
        if (recordedPoints.length > 0) {
            drawScribble(recordedPoints);
        }
    }, [recordedPoints]);

    const generateImage = () => {
        setGenerateBtnText('Generating...');
        var canvas = scribbleCanvasRef.current;
        const scrible = canvas.toDataURL("image/png");
        callImageGenAPI(scrible);
      };

    

    const callImageGenAPI = async(scrible) => {
        console.log("Image generation called")

        const requestData = {
            image: scrible,
            prompt:prompt,
            additional_prompt: additionalPrompt,
            negative_prompt: negativePrompt,
            num_images: numImages,
            image_resolution: imageResolution,
            preprocess_resolution: 512,
            num_steps: numSteps,
            guidance_scale: promptGuidance,
            seed: seed,
        };
    
        // Make a POST request to the API endpoint
        fetch('https://1137-34-125-22-152.ngrok-free.app/generate', {
            method: 'POST', headers: {
            'Content-Type': 'application/json'
            }, body: JSON.stringify(requestData)
        }).then(response => {
            // Check if the response is successful
            if (!response.ok) {
            throw new Error('Network response was not ok');
            }
            // Parse the JSON response
            return response.json();
        })
        .then(data => {
            // Handle the response data
            setImageUrls(data.image);
            setGenerateBtnText("Generate");
            console.log('Response from API:', data);
        })
        .catch(error => {
            // Handle errors
            console.error('There was a problem with the fetch operation:', error);
        });
        
    };    

  
  // Button Component
  const Button = ({ onClick, label }) => (
    <button onClick={onClick}>{label}</button>
  );

    return (
    <div className="App">
      <header className="App-header">   
        <h1>Doodle by hand to image</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ width: '50%', margin: '20px' }}>
                <h2>Additional hyperparameters</h2>
                <span>Optimize your image generation with these advanced settings. Adjust the sliders to control the output's quantity, clarity, complexity, and uniqueness. Ideal for users seeking a fine balance between creativity and precision, these settings encourage experimentation to discover the perfect configuration for your creative vision.</span>
                <div style={{ 
                    margin: '20px', 
                    borderRadius: '8px', 
                    background: 'linear-gradient(to right, #ddd 0%, #ddd 100%)', 
                    WebkitAppearance: 'none', 
                    padding: '10px' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px',
                        borderRadius: '8px', 
                        background: '#636363', 
                        color: 'white',
                        WebkitAppearance: 'none', 
                        padding: '10px',
                        margin: '10px 0px' }}>
                    <div>Number of Images to Generate:</div>
                    <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={numImages}
                        onChange={(e) => setNumImages(e.target.value)}
                        style={{ 
                            flexGrow: 1
                        }}
                    />
                    <div>{numImages}</div>
                    </div>
                    <div style={{ 
                        marginBottom: '20px', 
                        fontSize: '18px',
                        fontWeight: 'bold' }}>Tip: Generating multiple images lets you explore a range of interpretations of your prompt, enhancing creativity and selection.</div>
                </div>
                <div style={{ 
                    margin: '20px', 
                    borderRadius: '8px', 
                    background: 'linear-gradient(to right, #ddd 0%, #ddd 100%)', 
                    WebkitAppearance: 'none', 
                    padding: '10px' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px',
                        borderRadius: '8px', 
                        background: '#636363', 
                        color: 'white',
                        WebkitAppearance: 'none', 
                        padding: '10px',
                        margin: '10px 0px' }}>
                    <div>Output Image Resolution:</div>
                    <input
                        type="range"
                        min={256}
                        max={768}
                        step={128}
                        value={imageResolution}
                        onChange={(e) => setImageResolution(e.target.value)}
                        style={{ 
                            flexGrow: 1
                        }}
                    />
                    <div>{imageResolution}</div>
                    </div>
                    <div style={{ 
                        marginBottom: '20px', 
                        fontSize: '18px',
                        fontWeight: 'bold' }}>Tip: A higher resolution captures more details but requires more processing time. Choose based on your need for detail versus speed.</div>
                </div>
                <div style={{ 
                    margin: '20px', 
                    borderRadius: '8px', 
                    background: 'linear-gradient(to right, #ddd 0%, #ddd 100%)', 
                    WebkitAppearance: 'none', 
                    padding: '10px' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px',
                        borderRadius: '8px', 
                        background: '#636363', 
                        color: 'white',
                        WebkitAppearance: 'none', 
                        padding: '10px',
                        margin: '10px 0px' }}>
                    <div>Generation Iterations:</div>
                    <input
                        type="range"
                        min={1}
                        max={100}
                        step={5}
                        value={numSteps}
                        onChange={(e) => setNumSteps(e.target.value)}
                        style={{ 
                            flexGrow: 1
                        }}
                    />
                    <div>{numSteps}</div>
                    </div>
                    <div style={{ 
                        marginBottom: '20px', 
                        fontSize: '18px',
                        fontWeight: 'bold' }}>Tip: Increasing iterations generally improves image quality at the cost of longer generation times. Find a balance that works for your needs.</div>
                </div>
                <div style={{ 
                    margin: '20px', 
                    borderRadius: '8px', 
                    background: 'linear-gradient(to right, #ddd 0%, #ddd 100%)', 
                    WebkitAppearance: 'none', 
                    padding: '10px' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px',
                        borderRadius: '8px', 
                        background: '#636363', 
                        color: 'white',
                        WebkitAppearance: 'none', 
                        padding: '10px' }}>
                    <div>Seed for Randomness Control:</div>
                        <input
                            type="range"
                            min={0}
                            max={84}
                            step={2}
                            value={seed}
                            onChange={(e) => setSeed(e.target.value)}
                            style={{ 
                                flexGrow: 1
                            }}
                        />
                        <div>{seed}</div>
                    </div>
                    <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            gap: '10px',
                            borderRadius: '8px', 
                            background: '#636363', 
                            color: 'white',
                            WebkitAppearance: 'none', 
                            padding: '10px',
                            margin: '10px 0px' }}>
                        <div>Enable Random Seed:</div>
                        <input
                                type="checkbox"
                                checked={randomSeed}
                                onChange={(e) => setRandomSeed(e.target.checked)}
                            />
                        </div>
                        <div style={{ 
                        marginBottom: '20px', 
                        fontSize: '18px',
                        fontWeight: 'bold' }}>Tip: Consistent seeds reproduce identical results, useful for refining your creations. Toggle randomness for unique outcomes.</div>
                </div>
            </div>
            <div style={{ width: '50%', margin: '20px'}}>
                <h2>Prompting</h2>
                <span>Effectively communicate your creative vision to the AI through prompts. Craft clear, descriptive prompts to guide the AI towards generating images that closely match your imagination. Utilize additional and negative prompts to refine and exclude certain elements, offering more control over the outcome.</span>
                <div style={{ 
                    margin: '20px',
                    borderRadius: '8px', 
                    width: "640px", 
                    height: "480px", 
                    background: 'linear-gradient(to right, #ddd 0%, #ddd 100%)', 
                    WebkitAppearance: 'none', 
                    padding: '10px 10px' }}>
                    <div style={{ 
                        position: "relative", 
                        width: "100%", 
                        height: "100%", 
                        borderRadius: '8px', 
                        background: 'linear-gradient(to right, #ddd 0%, #ddd 100%)', 
                        WebkitAppearance: 'none',
                        
                    }}>
                        <video className='video'
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted 
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%", 
                                height: "100%", 
                            }}
                        ></video>
                        <canvas className='video'
                            ref={canvasRef}
                            style={{ 
                                position: "absolute", 
                                top: 0, 
                                left: 0,
                                zIndex: 1, 
                                width: "100%", 
                                height: "100%", 
                            }}
                        ></canvas>
                        <canvas className='video'
                            ref={scribbleCanvasRef}
                            style={{ 
                                position: "absolute", 
                                top: 0, 
                                left: 0,
                                zIndex: 2, 
                                width: "100%", // Ensure it matches the container size
                                height: "100%", // Ensure it matches the container size
                            }}
                        ></canvas>
                    </div>
                </div>
                <div style={{ 
                    margin: '20px',
                    borderRadius: '8px', 
                    background: 'linear-gradient(to right, #ddd 0%, #ddd 100%)', 
                    WebkitAppearance: 'none', 
                    padding: '10px 0px' }}>
                    <div style={{ margin: '10px' }}>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            gap: '10px',
                            borderRadius: '8px', 
                            background: '#636363', 
                            color: 'white',
                            WebkitAppearance: 'none', 
                            padding: '10px',
                            margin: '10px 0px'
                            }}>
                        <div>Main Prompt:</div>
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Enter your main idea or theme here..."
                            style={{
                            flexGrow: 1,
                            borderRadius: '8px',
                            border: '1px solid #ccc', 
                            padding: '8px',
                            background: 'linear-gradient(to right, #eee, #fff)', 
                            outline: 'none', 
                            }}
                            />
                        </div>
                    </div>
                    <div style={{ margin: '10px' }}>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            gap: '10px',
                            borderRadius: '8px', 
                            background: '#636363', 
                            color: 'white',
                            WebkitAppearance: 'none', 
                            padding: '10px',
                            margin: '10px 0px'
                            }}>
                        <div>Refine with Additional Prompt:</div>
                        <input
                            type="text"
                            value={additionalPrompt}
                            onChange={(e) => setAdditionalPrompt(e.target.value)}
                            placeholder="(Optional)"
                            style={{
                            flexGrow: 1,
                            borderRadius: '8px',
                            border: '1px solid #ccc', 
                            padding: '8px',
                            background: 'linear-gradient(to right, #eee, #fff)', 
                            outline: 'none', 
                            }}
                            />
                        </div>
                        <div style={{ 
                        margin: '20px', 
                        fontSize: '18px',
                        fontWeight: 'bold' }}>Tip: Use positive promps to add more details or specific elements you want included in your image.</div>
                    </div>
                    <div style={{ margin: '10px' }}>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            gap: '10px',
                            borderRadius: '8px', 
                            background: '#636363', 
                            color: 'white',
                            WebkitAppearance: 'none', 
                            padding: '10px',
                            margin: '10px 0px'
                            }}>
                        <div>Refine with Additional Prompt:</div>
                        <input
                            type="text"
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder="(Optional)"
                            style={{
                            flexGrow: 1,
                            borderRadius: '8px',
                            border: '1px solid #ccc', 
                            padding: '8px',
                            background: 'linear-gradient(to right, #eee, #fff)', 
                            outline: 'none', 
                            }}
                            />
                        </div>
                        <div style={{ 
                        margin: '20px', 
                        fontSize: '18px',
                        fontWeight: 'bold' }}>Tip: Use negative promps to avoid unwanted artfifacts to be included in your generated image.</div>
                    </div>
                </div>
                <div style={{ 
                    margin: '20px', 
                    borderRadius: '8px', 
                    background: 'linear-gradient(to right, #ddd 0%, #ddd 100%)', 
                    WebkitAppearance: 'none', 
                    padding: '10px' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px',
                        borderRadius: '8px', 
                        background: '#636363', 
                        color: 'white',
                        WebkitAppearance: 'none', 
                        padding: '10px',
                        margin: '10px 0px' }}>
                    <div>Guidance Control:</div>
                    <input
                        type="range"
                        min={0.1}
                        max={30.0}
                        step={0.1}
                        value={promptGuidance}
                        onChange={(e) => setPromptGuidance(e.target.value)}
                        style={{ 
                            flexGrow: 1
                        }}
                    />
                    <div>{promptGuidance}</div>
                    </div>
                    <div style={{ 
                        marginBottom: '20px', 
                        fontSize: '18px',
                        fontWeight: 'bold' }}>Tip: Adjust the guidance to influence the creativity of the generated images.</div>
                </div>
            </div>
        </div>
        <div>
            <button className='button-6' onClick={() => {setRecordedPoints([]); drawScribble([])}}>Clear</button>
            <button className='button-6' onClick={() => saveScribble()}>Save</button>
            <button className='button-6' onClick={generateImage}>{generateBtnText}</button>
            <button className='button-6' onClick={() => resetStates()}>Reset</button>
        </div>
        {/*<p className='small'>Recorded Points: {JSON.stringify(recordedPoints)}</p>*/}
        <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "20px"
        }}>
            {imageUrls.map((url, index) => (
                <img 
                    key={index} 
                    src={url} 
                    alt={`Generated Image ${index + 1}`}
                    style={{
                        width: `calc(${imageWidthPercentage}% - 20px)`, // Adjusting for 10px gap on either side
                        height: 'auto'
                    }}
                />
            ))}
        </div>
      </header>
    </div>
    );
};

export default WebcamDisplay;