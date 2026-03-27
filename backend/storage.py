import os
import math

class MultiCloudStorageManager:
    def __init__(self):
        # Define our simulated cloud directories
        self.clouds = {
            "aws": "./cloud_aws",
            "azure": "./cloud_azure",
            "gcp": "./cloud_gcp"
        }
        # Ensure these directories exist
        for path in self.clouds.values():
            os.makedirs(path, exist_ok=True)

    def split_and_upload(self, file_id: str, encrypted_bytes: bytes):
        """Splits the encrypted file into 3 chunks and 'uploads' them."""
        total_length = len(encrypted_bytes)
        chunk_size = math.ceil(total_length / 3)

        chunks = [
            encrypted_bytes[0:chunk_size],
            encrypted_bytes[chunk_size:chunk_size*2],
            encrypted_bytes[chunk_size*2:]
        ]

        # "Upload" to simulated clouds
        cloud_names = list(self.clouds.keys())
        metadata = {}

        for i, cloud in enumerate(cloud_names):
            chunk_path = os.path.join(self.clouds[cloud], f"{file_id}_part{i+1}.bin")
            with open(chunk_path, "wb") as f:
                f.write(chunks[i])
            
            # Record where this piece went
            metadata[f"part{i+1}"] = {"cloud": cloud, "path": chunk_path}
            print(f"Uploaded {file_id} Part {i+1} to {cloud.upper()} simulator.")

        return metadata

    def download_and_reconstruct(self, file_id: str, chunk_metadata: dict) -> bytes:
        """Fetches the 3 chunks from the clouds and pieces them back together."""
        reconstructed_bytes = b""

        # Must reconstruct in the exact order: part1, part2, part3
        for i in range(1, 4):
            part_key = f"part{i}"
            if part_key not in chunk_metadata:
                raise Exception(f"Missing metadata for {part_key}")
            
            chunk_path = chunk_metadata[part_key]["path"]
            
            try:
                with open(chunk_path, "rb") as f:
                    reconstructed_bytes += f.read()
                print(f"Downloaded {file_id} {part_key} from {chunk_metadata[part_key]['cloud'].upper()} simulator.")
            except FileNotFoundError:
                raise Exception(f"Could not find {part_key} in the simulated cloud storage.")

        return reconstructed_bytes

# Instantiate a global manager we can use in main.py
storage_manager = MultiCloudStorageManager()