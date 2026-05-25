import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ComplaintForm from "./ComplaintForm";
import { AlertTriangle, X } from "lucide-react";

interface FloatingComplaintButtonProps {
  preselectedDeviceId?: string;
}

const FloatingComplaintButton: React.FC<FloatingComplaintButtonProps> = ({
  preselectedDeviceId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const openComplaintForm = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        <motion.div
          className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 items-end"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          {/* Menu Items */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                className="flex flex-col gap-2"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={openComplaintForm}
                  className="group relative flex items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-white shadow-lg hover:shadow-red-500/50 transition-all"
                >
                  <span className="text-sm font-medium">Report Issue</span>
                  <AlertTriangle className="h-4 w-4" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Floating Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleMenu}
            className="group relative h-14 w-14 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/75 transition-all flex items-center justify-center text-white"
          >
            <motion.div
              animate={{ rotate: isOpen ? 45 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </motion.div>

            {/* Pulsing indicator */}
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-cyan-400/20"
            />
          </motion.button>
        </motion.div>
      </AnimatePresence>

      {/* Complaint Form Modal */}
      <ComplaintForm
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        preselectedDeviceId={preselectedDeviceId}
      />
    </>
  );
};

export default FloatingComplaintButton;
