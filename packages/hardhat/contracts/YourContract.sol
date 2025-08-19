// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title University Election Contract
 * @dev A secure contract for managing university elections and professor enrollments
 * @notice This contract handles university elections with encrypted voting and professor management
 */
contract YourContract {
    // ============ CONSTANTS ============
    
    uint256 public constant CAP = 30; // Maximum professors per university
    uint256 public constant ENROLLMENT_FEE = 10 wei; // Fee for professor enrollment
    uint256 public constant ELECTION_START_FEE = 100 wei; // Fee to start election
    uint256 public constant ELECTION_DURATION_BLOCKS = 1000; // Election duration in blocks
    uint256 public constant QUORUM_PERCENTAGE = 50; // Percentage needed for quorum (50%)

    // ============ ENUMS ============
    
    enum Status { NO_ELECTION, IN_PROGRESS, CLOSED }

    // ============ STATE VARIABLES ============
    
    // Current President (winner of last election)
    address public currentPresident;
    
    // University and professor mappings
    mapping(address => uint256) public universityProfessors;
    mapping(address => bool) public isUniversity;
    mapping(address => address) public professorToUniversity;
    mapping(address => string) public universityNames;
    
    // Voting mappings
    mapping(address => string) public votesMap;
    mapping(address => bool) public hasVoted;
    
    // Election state
    Status public VOTE_STATUS;
    uint256 public votesNumber;
    uint256 public electionEndBlock;
    address public universityThatStartedElection; // University that started current election
    address public feeHoldingAddress; // Address holding the election fee
    uint256 public heldFee; // Amount of fee being held
    string public WINNER;
    
    // University list
    address[] public universities;
    uint256 public univNumber;

    // ============ EVENTS ============
    
    event PresidentChanged(address indexed previousPresident, address indexed newPresident);
    event UniversityAdded(address indexed university, string name);
    event UniversityRemoved(address indexed university, string name);
    event UniversityVoted(address indexed university, string voteHash);
    event ProfessorEnrolled(address indexed professor, address indexed university, uint256 totalProfessors, uint256 feePaid);
    event ProfessorRemoved(address indexed professor, address indexed university, uint256 totalProfessors);
    event StatusChanged(Status newStatus);
    event ElectionStarted(address indexed university, uint256 electionEndBlock, uint256 feeHeld);
    event ElectionClosed(string winner, uint256 totalVotes);
    event FeeReceived(address indexed from, address indexed to, uint256 amount);
    event FeeReturned(address indexed to, uint256 amount);

    // ============ MODIFIERS ============
    
    modifier onlyCurrentPresident() {
        require(msg.sender == currentPresident, "Only current president can call this function");
        _;
    }
    
    modifier onlyWhenNoElection() {
        require(VOTE_STATUS == Status.NO_ELECTION, "Action not allowed during election");
        _;
    }

    modifier onlyDuringElection() {
        require(VOTE_STATUS == Status.IN_PROGRESS, "Election is not in progress");
        require(block.number < electionEndBlock, "Election has ended");
        _;
    }

    modifier onlyUniversities() {
        require(isUniversity[msg.sender], "Sender is not a recognized university");
        _;
    }

    modifier onlyWhenClosed() {
        require(VOTE_STATUS == Status.CLOSED, "Election is not closed");
        _;
    }

    modifier validAddress(address _address) {
        require(_address != address(0), "Invalid address: zero address");
        _;
    }

    modifier nonReentrant() {
        require(VOTE_STATUS != Status.IN_PROGRESS || !hasVoted[msg.sender], "Reentrancy not allowed");
        _;
    }

    // ============ CONSTRUCTOR ============
    
    constructor() {
        // No initial president - will be the deployer
        currentPresident = msg.sender;
        VOTE_STATUS = Status.NO_ELECTION;
        votesNumber = 0;
        univNumber = 0;
        heldFee = 0;

        emit PresidentChanged(address(0), currentPresident);
    }

    // ============ PRESIDENT MANAGEMENT FUNCTIONS ============
    
    /**
     * @dev Add a new university to the system (only current president)
     * @param university The address of the university
     * @param name The name of the university
     */
    function addUniversity(address university, string memory name) 
        external 
        onlyCurrentPresident 
        onlyWhenNoElection 
        validAddress(university) 
    {
        require(!isUniversity[university], "University already exists");
        require(bytes(name).length > 0, "University name cannot be empty");
        require(bytes(name).length <= 100, "University name too long");
        require(university != currentPresident, "President cannot be a university");

        universities.push(university);
        isUniversity[university] = true;
        universityNames[university] = name;
        universityProfessors[university] = 0;
        univNumber = universities.length;

        emit UniversityAdded(university, name);
    }

    /**
     * @dev Remove a university from the system (only current president)
     * @param university The address of the university to remove
     */
    function removeUniversity(address university) 
        external 
        onlyCurrentPresident 
        onlyWhenNoElection 
        validAddress(university) 
    {
        require(isUniversity[university], "University does not exist");
        require(universityProfessors[university] == 0, "Cannot remove university with enrolled professors");

        // Find and remove university from array
        for (uint256 i = 0; i < universities.length; i++) {
            if (universities[i] == university) {
                universities[i] = universities[universities.length - 1];
                universities.pop();
                break;
            }
        }

        string memory name = universityNames[university];
        
        // Clean up mappings
        isUniversity[university] = false;
        universityNames[university] = "";
        hasVoted[university] = false;
        votesMap[university] = "";
        
        univNumber = universities.length;

        emit UniversityRemoved(university, name);
    }

    // ============ PROFESSOR MANAGEMENT FUNCTIONS ============
    
    /**
     * @dev Enroll a professor in a university
     * @param university The university address to enroll the professor in
     */
    function enrollProfessor(address university) 
        external 
        payable 
        onlyWhenNoElection 
        validAddress(university)
        nonReentrant 
    {
        require(isUniversity[university], "Invalid university address");
        require(professorToUniversity[msg.sender] == address(0), "Professor already enrolled");
        require(universityProfessors[university] < CAP, "University at capacity");
        require(msg.value >= ENROLLMENT_FEE, "Insufficient enrollment fee");
        require(msg.sender != university, "University cannot enroll itself as professor");

        // Store the fee for potential refund calculation
        uint256 feeToTransfer = ENROLLMENT_FEE;
        uint256 refund = msg.value - ENROLLMENT_FEE;

        // Assign professor to university
        professorToUniversity[msg.sender] = university;
        universityProfessors[university] += 1;

        // Transfer fee to university
        (bool success, ) = payable(university).call{value: feeToTransfer}("");
        require(success, "Fee transfer to university failed");

        // Refund excess payment
        if (refund > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: refund}("");
            require(refundSuccess, "Refund failed");
        }

        emit FeeReceived(msg.sender, university, feeToTransfer);
        emit ProfessorEnrolled(msg.sender, university, universityProfessors[university], feeToTransfer);
    }

    /**
     * @dev Remove a professor from their current university
     */
    function removeProfessor() external onlyWhenNoElection nonReentrant {
        address university = professorToUniversity[msg.sender];
        require(university != address(0), "Professor not enrolled in any university");

        // Update state before external call (CEI pattern)
        universityProfessors[university] -= 1;
        professorToUniversity[msg.sender] = address(0);

        emit ProfessorRemoved(msg.sender, university, universityProfessors[university]);
    }

    // ============ ELECTION FUNCTIONS ============
    
    /**
     * @dev Start a new election (can be called by any university with fee)
     */
    function startVotation() external payable onlyWhenNoElection onlyUniversities nonReentrant {
        require(univNumber > 0, "No universities registered");
        require(msg.value >= ELECTION_START_FEE, "Insufficient election start fee");
        
        // Store fee information
        uint256 refund = msg.value - ELECTION_START_FEE;
        heldFee = ELECTION_START_FEE;
        feeHoldingAddress = address(this);
        universityThatStartedElection = msg.sender;
        
        // Refund excess payment
        if (refund > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: refund}("");
            require(refundSuccess, "Refund failed");
        }

        // Set election state
        VOTE_STATUS = Status.IN_PROGRESS;
        electionEndBlock = block.number + ELECTION_DURATION_BLOCKS;
        votesNumber = 0;

        // Reset voting state for all universities
        for (uint256 i = 0; i < universities.length; i++) {
            hasVoted[universities[i]] = false;
            votesMap[universities[i]] = "";
        }

        emit ElectionStarted(msg.sender, electionEndBlock, heldFee);
        emit StatusChanged(VOTE_STATUS);
    }

    /**
     * @dev Submit a vote during an active election
     * @param voteData The encrypted vote data as a JSON string
     */
    function vote(string memory voteData) external onlyDuringElection onlyUniversities {
        require(!hasVoted[msg.sender], "University has already voted");
        require(bytes(voteData).length > 0, "Vote data cannot be empty");
        require(bytes(voteData).length <= 1000, "Vote data too large");

        // Mark university as voted and store vote
        hasVoted[msg.sender] = true;
        votesMap[msg.sender] = voteData;
        votesNumber += 1;

        emit UniversityVoted(msg.sender, voteData);

        // Auto-check if election should close
        _checkElectionStatus();
    }

    /**
     * @dev Check if election should be closed and close it if conditions are met
     */
    function checkStatus() external {
        _checkElectionStatus();
    }

    /**
     * @dev Internal function to check and update election status
     */
    function _checkElectionStatus() internal {
        if (VOTE_STATUS == Status.IN_PROGRESS) {
            bool shouldClose = (votesNumber >= univNumber) || (block.number >= electionEndBlock);
            
            if (shouldClose) {
                VOTE_STATUS = Status.CLOSED;
                emit StatusChanged(VOTE_STATUS);
            }
        }
    }

    /**
     * @dev Close the election and set the winner
     * @param winningVote The winning vote result as a JSON string
     */
    function close(string memory winningVote) external onlyWhenClosed {
        require(bytes(winningVote).length > 0, "Winner data cannot be empty");
        require(bytes(winningVote).length <= 500, "Winner data too large");

        // Store winner
        WINNER = winningVote;
        uint256 totalVotes = votesNumber;

        // Return fee to university that started election
        if (heldFee > 0 && universityThatStartedElection != address(0)) {
            uint256 feeToReturn = heldFee;
            address recipient = universityThatStartedElection;
            
            // Reset fee tracking
            heldFee = 0;
            feeHoldingAddress = address(0);
            
            // Transfer fee back
            (bool success, ) = payable(recipient).call{value: feeToReturn}("");
            if (success) {
                emit FeeReturned(recipient, feeToReturn);
            }
        }

        // Set new president based on election winner
        // In a real implementation, you'd parse winningVote to determine the new president
        // For simplicity, we'll set the university that started the election as the new president
        // You can modify this logic based on your specific requirements
        address newPresident = universityThatStartedElection;
        address oldPresident = currentPresident;
        currentPresident = newPresident;

        // Reset election state
        VOTE_STATUS = Status.NO_ELECTION;
        votesNumber = 0;
        electionEndBlock = 0;
        universityThatStartedElection = address(0);

        // Clear voting data
        for (uint256 i = 0; i < universities.length; i++) {
            hasVoted[universities[i]] = false;
            votesMap[universities[i]] = "";
        }

        emit ElectionClosed(winningVote, totalVotes);
        emit PresidentChanged(oldPresident, newPresident);
        emit StatusChanged(VOTE_STATUS);
    }

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get all university addresses
     * @return Array of university addresses
     */
    function getAllUniversities() external view returns (address[] memory) {
        return universities;
    }

    /**
     * @dev Get all university addresses with their names
     * @return addresses Array of university addresses
     * @return names Array of university names
     */
    function getAllUniversitiesWithNames() external view returns (address[] memory addresses, string[] memory names) {
        addresses = new address[](universities.length);
        names = new string[](universities.length);
        
        for (uint256 i = 0; i < universities.length; i++) {
            addresses[i] = universities[i];
            names[i] = universityNames[universities[i]];
        }
        
        return (addresses, names);
    }

    /**
     * @dev Get election information
     * @return status Current election status
     * @return endBlock Block number when election ends
     * @return totalVotes Number of votes cast
     * @return totalUniversities Total number of universities
     */
    function getElectionInfo() external view returns (
        Status status,
        uint256 endBlock,
        uint256 totalVotes,
        uint256 totalUniversities
    ) {
        return (VOTE_STATUS, electionEndBlock, votesNumber, univNumber);
    }

    /**
     * @dev Get university information
     * @param university The university address
     * @return isValid Whether the address is a valid university
     * @return name The name of the university
     * @return professorCount Number of professors in the university
     * @return voted Whether the university has voted in current election
     */
    function getUniversityInfo(address university) external view returns (
        bool isValid,
        string memory name,
        uint256 professorCount,
        bool voted
    ) {
        return (
            isUniversity[university], 
            universityNames[university], 
            universityProfessors[university], 
            hasVoted[university]
        );
    }

    /**
     * @dev Check if an address is a professor and get their university
     * @param professor The professor address to check
     * @return university The university the professor is enrolled in (address(0) if not enrolled)
     */
    function getProfessorInfo(address professor) external view returns (address university) {
        return professorToUniversity[professor];
    }

    /**
     * @dev Get current block number (useful for frontend)
     * @return Current block number
     */
    function getCurrentBlock() external view returns (uint256) {
        return block.number;
    }

    /**
     * @dev Get contract balance
     * @return Current contract balance in wei
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Check if an address is the current president
     * @param account The address to check
     * @return True if the address is the current president
     */
    function isCurrentPresident(address account) external view returns (bool) {
        return account == currentPresident;
    }

    /**
     * @dev Get held fee information
     * @return amount Amount of fee being held
     * @return holder Address holding the fee
     * @return starter University that started the election
     */
    function getHeldFeeInfo() external view returns (uint256 amount, address holder, address starter) {
        return (heldFee, feeHoldingAddress, universityThatStartedElection);
    }

    // ============ FALLBACK FUNCTIONS ============
    
    /**
     * @dev Fallback function to reject direct payments
     */
    receive() external payable {
        revert("Direct payments not accepted. Use specific functions.");
    }

    /**
     * @dev Fallback function for calls to non-existent functions
     */
    fallback() external payable {
        revert("Function does not exist");
    }
}