import re
from cryptography.fernet import Fernet

class ABESimulator:
    @staticmethod
    def generate_master_key():
        """Generates a secure symmetric key (Simulating ABE Master/Public Key generation)"""
        return Fernet.generate_key()

    @staticmethod
    def encrypt_file(file_bytes: bytes, key: bytes) -> bytes:
        """Encrypts the file data using the generated key"""
        f = Fernet(key)
        return f.encrypt(file_bytes)

    @staticmethod
    def decrypt_file(encrypted_bytes: bytes, key: bytes) -> bytes:
        """Decrypts the file data"""
        f = Fernet(key)
        return f.decrypt(encrypted_bytes)

    @staticmethod
    def evaluate_policy(policy_string: str, user_attributes: list[str]) -> bool:
        """
        Simulates Attribute-Based Access Control.
        Example Policy: "(HR and Manager) or Director"
        User Attributes: ["HR", "Manager"] -> Evaluates to True
        """
        # Convert policy to lowercase for easier parsing, except the attributes
        policy_lower = policy_string.lower()
        
        # Extract all potential attribute names from the policy using regex
        # This grabs words, ignoring operators like 'and', 'or', 'not' and symbols like '('
        words_in_policy = re.findall(r'\b[a-zA-Z_]+\b', policy_lower)
        operators = ['and', 'or', 'not']
        
        eval_string = policy_lower
        
        for word in set(words_in_policy):
            if word not in operators:
                # If the required attribute is in the user's list, replace it with 'True'
                # Otherwise, replace it with 'False'
                user_attrs_lower = [attr.lower() for attr in user_attributes]
                if word in user_attrs_lower:
                    eval_string = re.sub(rf'\b{word}\b', 'True', eval_string)
                else:
                    eval_string = re.sub(rf'\b{word}\b', 'False', eval_string)

        try:
            # Evaluate the final boolean string (e.g., "True and False or True")
            return eval(eval_string)
        except Exception as e:
            print(f"Policy evaluation error: {e}")
            return False

# Quick test to ensure the logic works if you run this file directly
if __name__ == "__main__":
    policy = "(HR and Manager) or Director"
    user_1_attrs = ["HR", "Intern"] # Should fail
    user_2_attrs = ["Director", "Finance"] # Should pass
    
    print(f"User 1 Access: {ABESimulator.evaluate_policy(policy, user_1_attrs)}") # False
    print(f"User 2 Access: {ABESimulator.evaluate_policy(policy, user_2_attrs)}") # True