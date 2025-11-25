import { useEffect, useState } from "react";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import { Lightbulb, Fan, Power, Wifi, WifiOff } from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  topic: string;
  type: "light" | "fan" | "outlet";
  status: "ON" | "OFF";
  isOnline: boolean;
}

export default function ControlPanel() {
  const mqttUrl = import.meta.env.VITE_MQTT_URL_CLIENT;
  const mqttUser = import.meta.env.VITE_HIVEMQ_USERNAME;
  const mqttPass = import.meta.env.VITE_HIVEMQ_PASSWORD;
  const mqttTopic27 = import.meta.env.VITE_MQTT_TOPIC_27;

  const [client, setClient] = useState<MqttClient | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [equipments, setEquipments] = useState<Equipment[]>([
    {
      id: "1",
      name: "Lampu Luar",
      topic: mqttTopic27,
      type: "light",
      status: "OFF",
      isOnline: false
    },
  ]);

  useEffect(() => {
    const mqttClient = mqtt.connect(mqttUrl, {
      username: mqttUser, // if required
      password: mqttPass, // if required
      reconnectPeriod: 2000,
    });

    mqttClient.on("connect", () => {
      console.log("MQTT Connected");
      mqttClient.subscribe("home/esp32/status");
      // Subscribe to status topics for each equipment
      equipments.forEach(equipment => {
        mqttClient.subscribe(`${equipment.topic}/status`);
      });
    });

    mqttClient.on("message", (topic: string, payload: Buffer) => {
      if (topic === "home/esp32/status") {
        setIsOnline(payload.toString() === "online");
      }
      
      // Update equipment status
      equipments.forEach(equipment => {
        if (topic === `${equipment.topic}/status`) {
          setEquipments(prev => prev.map(eq => 
            eq.topic === equipment.topic 
              ? { ...eq, status: payload.toString() as "ON" | "OFF", isOnline: true }
              : eq
          ));
        }
      });
    });

    mqttClient.on("error", (err) => {
      console.error("MQTT Error:", err);
    });

    setClient(mqttClient);

    return () => { mqttClient.end(); };
  }, []);

  const publishMessage = (topic: string, msg: "ON" | "OFF") => {
    if (!client) return;
    if (!isOnline) {
      alert("ESP32 is offline, cannot publish.");
      return;
    }
    client.publish(topic, msg);
    
    // Update local state immediately for better UX
    setEquipments(prev => prev.map(eq => 
      eq.topic === topic ? { ...eq, status: msg } : eq
    ));
  };

  const getEquipmentIcon = (type: string, status: "ON" | "OFF") => {
    const baseClasses = "w-8 h-8 transition-colors duration-300";
    
    switch (type) {
      case "light":
        return (
          <Lightbulb className={`${baseClasses} ${status === "ON" ? "text-yellow-400" : "text-gray-400"}`} />
        );
      case "fan":
        return (
          <Fan className={`${baseClasses} ${status === "ON" ? "text-blue-500 animate-spin" : "text-gray-400"}`} />
        );
      case "outlet":
        return (
          <Power className={`${baseClasses} ${status === "ON" ? "text-green-500" : "text-gray-400"}`} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Smart Home Control</h1>
          <div className="flex items-center justify-center space-x-4">
            <div className="text-lg text-gray-600">
              System Status:
              <span className={`ml-2 font-semibold ${isOnline ? "text-green-500" : "text-red-500"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            {isOnline ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
          </div>
        </div>

        {/* Equipment List - Single Column */}
        <div className="space-y-4">
          {equipments.map((equipment) => (
            <div
              key={equipment.id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                {/* Left Side: Equipment Info */}
                <div className="flex items-center space-x-6 flex-1">
                  <div className="flex items-center space-x-4">
                    {getEquipmentIcon(equipment.type, equipment.status)}
                    <div>
                      <h3 className="font-semibold text-gray-800 text-xl">{equipment.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">{equipment.type}</p>
                    </div>
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="flex items-center space-x-4">
                    <div className={`px-3 py-2 rounded-full text-sm font-medium ${
                      equipment.isOnline 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {equipment.isOnline ? "Connected" : "Offline"}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        equipment.status === "ON" ? "bg-green-500 animate-pulse" : "bg-gray-300"
                      }`}></div>
                      <span className={`font-medium text-lg ${
                        equipment.status === "ON" ? "text-green-600" : "text-gray-600"
                      }`}>
                        {equipment.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Control Buttons */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => publishMessage(equipment.topic, "ON")}
                    disabled={!isOnline || !equipment.isOnline}
                    className={`px-8 py-3 rounded-xl font-medium transition-all duration-200 ${
                      isOnline && equipment.isOnline
                        ? "bg-green-500 hover:bg-green-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    ON
                  </button>
                  <button
                    onClick={() => publishMessage(equipment.topic, "OFF")}
                    disabled={!isOnline || !equipment.isOnline}
                    className={`px-8 py-3 rounded-xl font-medium transition-all duration-200 ${
                      isOnline && equipment.isOnline
                        ? "bg-red-500 hover:bg-red-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}