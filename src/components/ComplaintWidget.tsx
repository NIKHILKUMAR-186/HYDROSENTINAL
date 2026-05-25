import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ComplaintForm from "./ComplaintForm";
import { AlertTriangle, MessageSquare } from "lucide-react";

interface ComplaintWidgetProps {
  preselectedDeviceId?: string;
}

const ComplaintWidget: React.FC<ComplaintWidgetProps> = ({
  preselectedDeviceId,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="group relative overflow-hidden bg-gradient-to-r from-red-500 to-orange-500 text-white hover:shadow-lg hover:shadow-red-500/50 transition-all"
          size="sm"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Report Issue</span>
          </div>
        </Button>
      </motion.div>

      <ComplaintForm
        open={isOpen}
        onOpenChange={setIsOpen}
        preselectedDeviceId={preselectedDeviceId}
      />
    </>
  );
};

export default ComplaintWidget;
